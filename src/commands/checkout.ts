import chalk from 'chalk';
import ora from 'ora';
import { getHead, loadBranch, loadCommit, loadSnapshot, setHead, listBranches } from '../core/store.js';
import { createPool, getConnectionConfig } from '../core/connector.js';
import { captureSnapshot } from '../core/snapshot.js';
import { diffSnapshots } from '../core/differ.js';
import { orderChanges } from '../core/dependencyGraph.js';
import { generateForwardSQL } from '../core/generator.js';
import { runInTransaction } from '../core/transaction.js';
import { loadIgnoreList } from '../core/ignore.js';

export async function checkoutCommand(ref: string) {
  const head = getHead();
  const branches = listBranches();
  const ignoreList = loadIgnoreList();
  const config = getConnectionConfig();
  const pool = createPool(config);

  let targetCommitHash: string;
  let targetBranchName: string | null = null;

  if (branches.includes(ref)) {
    const branch = loadBranch(ref);
    targetCommitHash = branch.headCommit;
    targetBranchName = ref;
  } else {
    try {
      const commit = loadCommit(ref);
      targetCommitHash = commit.commitHash;
    } catch (e) {
      console.error(chalk.red(`Error: '${ref}' is not a valid branch or commit hash.`));
      process.exit(1);
    }
  }

  if (targetCommitHash === head.commit) {
      setHead({ branch: targetBranchName, commit: targetCommitHash });
      console.log(chalk.green(`Switched to ${targetBranchName ? "branch '" + targetBranchName + "'" : "commit " + targetCommitHash}`));
      await pool.end();
      return;
  }

  const spinner = ora('Checking out...').start();
  try {
    const liveSnapshot = await captureSnapshot(pool, ignoreList);
    const targetSnapshot = targetCommitHash ? loadSnapshot(loadCommit(targetCommitHash).snapshotHash) : { tables: {}, capturedAt: '', schemaHash: '' };

    const changeset = diffSnapshots(liveSnapshot, targetSnapshot);

    if (changeset.hasDestructive) {
        spinner.warn(chalk.yellow('Warning: Destructive changes required to reach target state. Use rollback for safety checks.'));
        // For checkout, we'll proceed if it's just structural, but a real tool might be more cautious
    }

    const orderedChanges = orderChanges(changeset.changes, liveSnapshot);
    const sqlStatements = generateForwardSQL({ ...changeset, changes: orderedChanges });

    await runInTransaction(pool, sqlStatements);

    setHead({ branch: targetBranchName, commit: targetCommitHash });

    spinner.succeed(chalk.green(`Switched to ${targetBranchName ? "branch '" + targetBranchName + "'" : "commit " + targetCommitHash}`));
    if (!targetBranchName) {
      console.log(chalk.yellow(`HEAD is now detached at ${targetCommitHash}. You are not on a branch.`));
    }

    await pool.end();
  } catch (e: any) {
    spinner.fail(chalk.red(`Checkout failed: ${e.message}`));
    process.exit(1);
  }
}
