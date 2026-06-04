import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import crypto from 'crypto';
import { isInitialized, getHead, loadSnapshot, saveSnapshot, saveCommit, saveBranch, loadBranch, setHead, loadCommit } from '../core/store.js';
import { createPool, getConnectionConfig } from '../core/connector.js';
import { captureSnapshot } from '../core/snapshot.js';
import { diffSnapshots } from '../core/differ.js';
import { loadIgnoreList } from '../core/ignore.js';
import { Commit } from '../types/commits.js';

export async function commitCommand(options: { message: string }) {
  if (!isInitialized()) {
    console.error(chalk.red("Not a DBGit repository. Run 'dbgit init' first."));
    process.exit(1);
  }

  const head = getHead();
  if (head.branch === null) {
    console.error(chalk.red("Cannot commit in detached HEAD state. Run 'dbgit checkout <branch>' first."));
    process.exit(1);
  }

  const ignoreList = loadIgnoreList();
  const config = getConnectionConfig();
  const pool = createPool(config);

  const spinner = ora('Capturing schema snapshot...').start();
  try {
    const newSnapshot = await captureSnapshot(pool, ignoreList);
    let oldSnapshot = { tables: {}, capturedAt: '', schemaHash: '' };

    if (head.commit) {
      const lastCommit = loadCommit(head.commit);
      oldSnapshot = loadSnapshot(lastCommit.snapshotHash);
    }

    const changeset = diffSnapshots(oldSnapshot, newSnapshot);

    if (changeset.changes.length === 0) {
      spinner.stop();
      console.log(chalk.gray("Nothing to commit."));
      await pool.end();
      return;
    }

    spinner.stop();

    if (changeset.hasDestructive) {
      const destructiveChanges = changeset.changes.filter(c => c.isDestructive);
      console.warn(chalk.yellow('\nWarning: Destructive changes detected:'));
      destructiveChanges.forEach(c => {
        console.warn(chalk.red(`  - ${c.type}: ${c.table} ${c.objectName || ''}`));
      });

      const response = await prompts({
        type: 'confirm',
        name: 'value',
        message: 'Continue?',
        initial: false
      });

      if (!response.value) {
        console.log(chalk.gray('Commit aborted.'));
        await pool.end();
        return;
      }
    }

    const timestamp = new Date().toISOString();
    const commitHash = crypto.createHash('sha256').update(options.message + timestamp + newSnapshot.schemaHash).digest('hex').substring(0, 7);

    const commit: Commit = {
      commitHash,
      snapshotHash: newSnapshot.schemaHash,
      parent: head.commit,
      timestamp,
      message: options.message,
      branch: head.branch,
      schemaHash: newSnapshot.schemaHash
    };

    saveSnapshot(newSnapshot.schemaHash, newSnapshot);
    saveCommit(commit);

    const branch = loadBranch(head.branch);
    branch.headCommit = commitHash;
    saveBranch(branch);

    setHead({ ...head, commit: commitHash });

    console.log(chalk.green(`\n✓ Commit ${commitHash} saved.`));
    const tableCount = Object.keys(newSnapshot.tables).length;
    const colCount = Object.values(newSnapshot.tables).reduce((sum, t) => sum + t.columns.length, 0);
    const idxCount = Object.values(newSnapshot.tables).reduce((sum, t) => sum + t.indexes.length, 0);

    console.log(chalk.gray(`${tableCount} tables · ${colCount} columns · ${idxCount} indexes`));
    console.log(chalk.blue(`Branch: ${head.branch}`));

    await pool.end();
  } catch (e: any) {
    spinner.fail(chalk.red(`✗ Commit failed: ${e.message}`));
    process.exit(1);
  }
}
