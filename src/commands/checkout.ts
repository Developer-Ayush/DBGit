import chalk from 'chalk';
import { getHead, loadBranch, loadCommit, setHead, listBranches, isInitialized } from '../core/store.js';
import { createPool, getConnectionConfig } from '../core/connector.js';
import { captureSnapshot } from '../core/snapshot.js';
import { loadIgnoreList } from '../core/ignore.js';

export async function checkoutCommand(ref: string) {
  if (!isInitialized()) {
    console.error(chalk.red("Not a DBGit repository. Run 'dbgit init' first."));
    process.exit(1);
  }

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
      await pool.end();
      process.exit(1);
    }
  }

  // Check for drift before switching
  try {
    const liveSnapshot = await captureSnapshot(pool, ignoreList);
    let headSchemaHash = '';
    if (head.commit) {
      const headCommit = loadCommit(head.commit);
      headSchemaHash = headCommit.schemaHash;
    }

    if (headSchemaHash && liveSnapshot.schemaHash !== headSchemaHash) {
      console.warn(chalk.yellow('⚠ Live database contains uncommitted schema changes.'));
      console.warn(chalk.yellow('Checkout only changes DBGit state.'));
      console.warn(chalk.yellow('Database schema remains unchanged.'));
    }
  } catch (e: any) {
    console.warn(chalk.yellow(`⚠ Could not check for schema drift: ${e.message}`));
  }

  setHead({ branch: targetBranchName, commit: targetCommitHash });

  console.log(chalk.green(`✓ Switched to ${targetBranchName ? "branch '" + targetBranchName + "'" : "commit " + targetCommitHash}`));
  if (!targetBranchName) {
    console.log(chalk.yellow(`ℹ HEAD is now detached at ${targetCommitHash}. You are not on a branch.`));
  }

  console.log(chalk.yellow('⚠ Database schema unchanged.'));
  console.log(chalk.gray('Use dbgit rollback to modify database state.'));

  await pool.end();
}
