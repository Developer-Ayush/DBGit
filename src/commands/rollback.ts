import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import crypto from 'crypto';
import { isInitialized, getHead, loadCommit, loadSnapshot, setHead, loadConfig, saveCommit, saveSnapshot, saveBranch, loadBranch } from '../core/store.js';
import { createPool, getConnectionConfig, query } from '../core/connector.js';
import { captureSnapshot } from '../core/snapshot.js';
import { diffSnapshots } from '../core/differ.js';
import { validateSchemaNotDrifted } from '../core/validator.js';
import { acquireLock, releaseLock } from '../core/schemaLock.js';
import { createBackup } from '../core/backup.js';
import { orderChanges } from '../core/dependencyGraph.js';
import { generateForwardSQL } from '../core/generator.js';
import { runInTransaction } from '../core/transaction.js';
import { loadIgnoreList } from '../core/ignore.js';
import { ChangeType } from '../types/changes.js';
import { Commit } from '../types/commits.js';

export async function rollbackCommand(hash: string, options: { safe: boolean, force: boolean, dryRun: boolean, softDelete: boolean }) {
  if (!isInitialized()) {
    console.error(chalk.red("Not a DBGit repository. Run 'dbgit init' first."));
    process.exit(1);
  }

  const head = getHead();
  if (!head.commit) {
    console.error(chalk.red("No commits to rollback from."));
    process.exit(1);
  }

  const ignoreList = loadIgnoreList();
  const config = getConnectionConfig();
  const pool = createPool(config);
  const dbConfig = loadConfig();
  const isProd = dbConfig.DBGIT_MODE === 'prod';

  try {
    const targetCommit = loadCommit(hash);
    const headCommit = loadCommit(head.commit);

    const targetSnapshot = loadSnapshot(targetCommit.snapshotHash);

    const spinner = ora('Validating schema...').start();
    try {
      await validateSchemaNotDrifted(pool, headCommit, ignoreList);
    } catch (e: any) {
      spinner.fail(chalk.red(e.message));
      await pool.end();
      process.exit(1);
    }
    spinner.succeed('Schema validation passed.');

    const liveSnapshot = await captureSnapshot(pool, ignoreList);
    const changeset = diffSnapshots(liveSnapshot, targetSnapshot);

    if (changeset.changes.length === 0) {
      console.log("Database schema is already at target state.");
      await pool.end();
      return;
    }

    if (changeset.hasDestructive) {
      console.warn(chalk.yellow('\nDestructive changes required for rollback:'));
      for (const change of changeset.changes.filter(c => c.isDestructive)) {
        let impact = '';
        if (change.type === ChangeType.DROP_TABLE) {
          const rows = await query<{ count: string }>(pool, `SELECT count(*) FROM "${change.table}"`);
          impact = `(${rows[0].count} rows)`;
        } else if (change.type === ChangeType.DROP_COLUMN) {
          const rows = await query<{ count: string }>(pool, `SELECT count(*) FROM "${change.table}" WHERE "${change.objectName}" IS NOT NULL`);
          impact = `(${rows[0].count} non-null rows)`;
        }
        console.warn(chalk.red(`  ${change.type} ${change.table}${change.objectName ? '.' + change.objectName : ''} ${impact}`));
      }

      if (isProd) {
        if (!options.safe) {
          console.error(chalk.red("\nError: Production mode. Backup is mandatory for destructive operations. Use --safe."));
          process.exit(1);
        }
      } else {
        if (!options.force && !options.safe) {
          const response = await prompts({
            type: 'confirm',
            name: 'value',
            message: 'Continue with destructive rollback?',
            initial: false
          });
          if (!response.value) {
            console.log('Rollback aborted.');
            process.exit(1);
          }
        }
      }

      if (options.force && !isProd) {
        const response = await prompts({
          type: 'text',
          name: 'confirm',
          message: 'Type DESTROY DATA to continue:'
        });
        if (response.confirm !== 'DESTROY DATA') {
          console.log('Rollback aborted.');
          process.exit(1);
        }
      }

      if (options.safe) {
        const backupSpinner = ora('Creating backup...').start();
        const backupPath = await createBackup(head.commit, config);
        if (backupPath) {
          backupSpinner.succeed(`Backup created: ${backupPath}`);
        } else {
          backupSpinner.warn('Backup skipped or failed.');
        }
      }
    }

    const orderedChanges = orderChanges(changeset.changes, liveSnapshot);
    let sqlStatements = generateForwardSQL({ ...changeset, changes: orderedChanges });

    if (options.softDelete) {
      const timestamp = Date.now();
      sqlStatements = sqlStatements.map(sql => {
        if (sql.startsWith('DROP TABLE')) {
          const tableName = sql.replace('DROP TABLE ', '').trim();
          return `ALTER TABLE ${tableName} RENAME TO _dbgit_deleted_${tableName.replace(/"/g, '')}_${timestamp}`;
        }
        if (sql.includes('DROP COLUMN')) {
          const match = sql.match(/ALTER TABLE (.*) DROP COLUMN (.*)/);
          if (match) {
            return `ALTER TABLE ${match[1].trim()} RENAME COLUMN ${match[2].trim()} TO _dbgit_deleted_${match[2].trim().replace(/"/g, '')}_${timestamp}`;
          }
        }
        return sql;
      });
    }

    if (options.dryRun) {
      console.log(chalk.blue('\nDry run: SQL statements that would be executed:'));
      sqlStatements.forEach(sql => console.log(chalk.gray(sql)));
      console.log(chalk.green('\nDry run complete. Nothing executed.'));
      await pool.end();
      return;
    }

    await acquireLock(pool);
    const applySpinner = ora('Applying rollback...').start();
    try {
      await runInTransaction(pool, sqlStatements);

      // Create a NEW commit for the rollback
      const newCommitHash = crypto.createHash('sha256').update(Date.now().toString() + hash).digest('hex').substring(0, 7);

      const rollbackCommit: Commit = {
        commitHash: newCommitHash,
        snapshotHash: targetCommit.snapshotHash,
        parent: head.commit,
        timestamp: new Date().toISOString(),
        message: `rollback: restore schema state from ${hash.substring(0, 7)}`,
        branch: head.branch,
        schemaHash: targetCommit.schemaHash,
        type: 'rollback',
        targetCommit: hash
      };

      saveSnapshot(targetCommit.snapshotHash, targetSnapshot); // Ensure snapshot is saved for the new commit
      saveCommit(rollbackCommit);

      const newHead = { ...head, commit: newCommitHash };
      setHead(newHead);

      if (head.branch) {
        const branch = loadBranch(head.branch);
        branch.headCommit = newCommitHash;
        saveBranch(branch);
      }

      applySpinner.succeed(chalk.green(`Rolled back to ${hash.substring(0, 7)}. New commit ${newCommitHash} created.`));
    } finally {
      await releaseLock(pool);
    }

    await pool.end();
  } catch (e: any) {
    console.error(chalk.red(`Rollback failed: ${e.message}`));
    process.exit(1);
  }
}
