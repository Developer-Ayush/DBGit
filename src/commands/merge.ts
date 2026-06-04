import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';
import { getHead, loadBranch, loadCommit, loadSnapshot, saveCommit, saveSnapshot, saveBranch, setHead } from '../core/store.js';
import { createPool, getConnectionConfig } from '../core/connector.js';
import { captureSnapshot } from '../core/snapshot.js';
import { diffSnapshots } from '../core/differ.js';
import { orderChanges } from '../core/dependencyGraph.js';
import { generateForwardSQL } from '../core/generator.js';
import { runInTransaction } from '../core/transaction.js';
import { ChangeType } from '../types/changes.js';
import { Commit } from '../types/commits.js';

export async function mergeCommand(branchName: string) {
  const head = getHead();
  if (!head.branch) {
    console.error(chalk.red("Cannot merge in detached HEAD state."));
    process.exit(1);
  }

  const config = getConnectionConfig();
  const pool = createPool(config);

  const spinner = ora(`Merging branch '${branchName}' into '${head.branch}'...`).start();
  try {
    const targetBranch = loadBranch(branchName);
    const targetCommit = loadCommit(targetBranch.headCommit);
    const targetSnapshot = loadSnapshot(targetCommit.snapshotHash);

    const headCommit = loadCommit(head.commit!);
    const headSnapshot = loadSnapshot(headCommit.snapshotHash);

    // Simplistic merge: diff target against head and apply to live (which should match head)
    const changeset = diffSnapshots(headSnapshot, targetSnapshot);

    if (changeset.changes.length === 0) {
      spinner.succeed("Already up to date.");
      await pool.end();
      return;
    }

    // Conflict detection
    const conflicts: string[] = [];
    const headTableNames = Object.keys(headSnapshot.tables);

    changeset.changes.forEach(change => {
      // 1. Table modified on target but dropped on head
      if (change.type !== ChangeType.ADD_TABLE && change.type !== ChangeType.DROP_TABLE) {
          if (!headSnapshot.tables[change.table] && headTableNames.includes(change.table)) {
              conflicts.push(`Table '${change.table}' was dropped on ${head.branch} but modified on ${branchName}`);
          }
      }

      // 2. Table added on target but already exists on head (different schema)
      if (change.type === ChangeType.ADD_TABLE) {
        if (headSnapshot.tables[change.table]) {
            conflicts.push(`Table '${change.table}' exists on both branches with different definitions.`);
        }
      }

      // 3. Foreign key added on target referencing a table dropped on head
      if (change.type === ChangeType.ADD_FOREIGN_KEY) {
        const fk = change.after as any;
        if (!headSnapshot.tables[fk.targetTable] && headTableNames.includes(fk.targetTable)) {
          conflicts.push(`Foreign key '${fk.name}' on ${branchName} references table '${fk.targetTable}' which was dropped on ${head.branch}`);
        }
      }

      // 4. Index added on target to a table dropped on head
      if (change.type === ChangeType.ADD_INDEX) {
        if (!headSnapshot.tables[change.table] && headTableNames.includes(change.table)) {
          conflicts.push(`Index '${change.objectName}' on ${branchName} added to table '${change.table}' which was dropped on ${head.branch}`);
        }
      }
    });

    if (conflicts.length > 0) {
      spinner.fail(chalk.red("Merge aborted. Resolve conflicts manually."));
      conflicts.forEach(c => console.log(chalk.red(`  Conflict: ${c}`)));
      await pool.end();
      process.exit(1);
    }

    const liveSnapshot = await captureSnapshot(pool, []);
    const orderedChanges = orderChanges(changeset.changes, liveSnapshot);
    const sqlStatements = generateForwardSQL({ ...changeset, changes: orderedChanges });

    await runInTransaction(pool, sqlStatements);

    // Create merge commit
    const timestamp = new Date().toISOString();
    const message = `Merge branch '${branchName}' into '${head.branch}'`;
    const commitHash = crypto.createHash('sha256').update(message + timestamp + targetSnapshot.schemaHash).digest('hex').substring(0, 7);

    const mergeCommit: Commit = {
      commitHash,
      snapshotHash: targetSnapshot.schemaHash,
      parent: head.commit,
      timestamp,
      message,
      branch: head.branch,
      schemaHash: targetSnapshot.schemaHash
    };

    saveSnapshot(targetSnapshot.schemaHash, targetSnapshot);
    saveCommit(mergeCommit);

    const currentBranch = loadBranch(head.branch);
    currentBranch.headCommit = commitHash;
    saveBranch(currentBranch);
    setHead({ ...head, commit: commitHash });

    spinner.succeed(chalk.green(`Merged branch '${branchName}' into '${head.branch}'.`));
    console.log(`Applied ${changeset.changes.length} changes.`);

    await pool.end();
  } catch (e: any) {
    spinner.fail(chalk.red(`Merge failed: ${e.message}`));
    process.exit(1);
  }
}
