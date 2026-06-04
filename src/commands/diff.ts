import chalk from 'chalk';
import ora from 'ora';
import { getHead, loadCommit, loadSnapshot } from '../core/store.js';
import { createPool, getConnectionConfig, query } from '../core/connector.js';
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
      console.log(chalk.gray("No changes since last commit."));
      await pool.end();
      return;
    }

    // Stable sort by table name then change type
    const sortedChanges = [...changeset.changes].sort((a, b) => {
      if (a.table !== b.table) return a.table.localeCompare(b.table);
      return a.type.localeCompare(b.type);
    });

    for (const change of sortedChanges) {
      let impact = '';
      if (change.type === ChangeType.DROP_TABLE) {
        const rows = await query<{ count: string }>(pool, `SELECT count(*) FROM ${change.table}`);
        impact = chalk.gray(` (${rows[0].count} rows)`);
      } else if (change.type === ChangeType.DROP_COLUMN) {
        const rows = await query<{ count: string }>(pool, `SELECT count(*) FROM ${change.table} WHERE ${change.objectName} IS NOT NULL`);
        impact = chalk.gray(` (${rows[0].count} non-null rows)`);
      }

      switch (change.type) {
        case ChangeType.ADD_TABLE:
          console.log(chalk.green(`  + table  ${change.table}`));
          break;
        case ChangeType.DROP_TABLE:
          console.log(chalk.red(`  - table  ${change.table}${impact}`));
          break;
        case ChangeType.ADD_COLUMN:
          console.log(chalk.green(`  + column ${change.table}.${change.objectName} ${(change.after as any).type}`));
          break;
        case ChangeType.DROP_COLUMN:
          console.log(chalk.red(`  - column ${change.table}.${change.objectName}${impact}`));
          break;
        case ChangeType.MODIFY_COLUMN:
          console.log(chalk.yellow(`  ~ column ${change.table}.${change.objectName} ${(change.before as any).type} → ${(change.after as any).type}`));
          break;
        case ChangeType.ADD_INDEX:
          console.log(chalk.green(`  + index  ${change.objectName} on ${change.table}`));
          break;
        case ChangeType.DROP_INDEX:
          console.log(chalk.red(`  - index  ${change.objectName} on ${change.table}`));
          break;
        case ChangeType.ADD_CONSTRAINT:
          console.log(chalk.green(`  + constr ${change.objectName} on ${change.table}`));
          break;
        case ChangeType.DROP_CONSTRAINT:
          console.log(chalk.red(`  - constr ${change.objectName} on ${change.table}`));
          break;
        case ChangeType.ADD_FOREIGN_KEY:
          console.log(chalk.green(`  + fk     ${change.objectName} on ${change.table}`));
          break;
        case ChangeType.DROP_FOREIGN_KEY:
          console.log(chalk.red(`  - fk     ${change.objectName} on ${change.table}`));
          break;
        default:
          console.log(chalk.blue(`  * ${change.type}: ${change.table} ${change.objectName || ''}`));
      }
    }

    await pool.end();
  } catch (e: any) {
    if (spinner.isSpinning) spinner.stop();
    console.error(chalk.red(`✗ Diff failed: ${e.message}`));
    process.exit(1);
  }
}
