import chalk from 'chalk';
import ora from 'ora';
import { getHead, loadCommit, loadSnapshot } from '../core/store.js';
import { createPool, getConnectionConfig } from '../core/connector.js';
import { captureSnapshot } from '../core/snapshot.js';
import { diffSnapshots } from '../core/differ.js';
import { loadIgnoreList } from '../core/ignore.js';
import { ChangeType } from '../types/changes.js';

export async function diffCommand() {
  const head = getHead();
  const ignoreList = loadIgnoreList();
  const config = getConnectionConfig();
  const pool = createPool(config);

  const spinner = ora('Computing diff...').start();
  try {
    const liveSnapshot = await captureSnapshot(pool, ignoreList);
    let oldSnapshot = { tables: {}, capturedAt: '', schemaHash: '' };

    if (head.commit) {
      const lastCommit = loadCommit(head.commit);
      oldSnapshot = loadSnapshot(lastCommit.snapshotHash);
    }

    const changeset = diffSnapshots(oldSnapshot, liveSnapshot);

    spinner.stop();

    if (changeset.changes.length === 0) {
      console.log("No changes since last commit.");
      await pool.end();
      return;
    }

    changeset.changes.forEach(change => {
      switch (change.type) {
        case ChangeType.ADD_TABLE:
          console.log(chalk.green(`+ table ${change.table}`));
          break;
        case ChangeType.DROP_TABLE:
          console.log(chalk.red(`- table ${change.table}`));
          break;
        case ChangeType.ADD_COLUMN:
          console.log(chalk.green(`+ column ${change.table}.${change.objectName} ${(change.after as any).type}`));
          break;
        case ChangeType.DROP_COLUMN:
          console.log(chalk.red(`- column ${change.table}.${change.objectName}`));
          break;
        case ChangeType.MODIFY_COLUMN:
          console.log(chalk.yellow(`~ column ${change.table}.${change.objectName} ${(change.before as any).type} → ${(change.after as any).type}`));
          break;
        case ChangeType.ADD_INDEX:
          console.log(chalk.green(`+ index ${change.objectName} on ${change.table}`));
          break;
        case ChangeType.DROP_INDEX:
          console.log(chalk.red(`- index ${change.objectName} on ${change.table}`));
          break;
        // ... add more as needed
        default:
          console.log(chalk.blue(`* ${change.type}: ${change.table} ${change.objectName || ''}`));
      }
    });

    await pool.end();
  } catch (e: any) {
    spinner.fail(chalk.red(`Diff failed: ${e.message}`));
    process.exit(1);
  }
}
