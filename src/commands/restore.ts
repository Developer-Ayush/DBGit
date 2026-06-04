import chalk from 'chalk';
import ora from 'ora';
import { loadSnapshot, loadCommit } from '../core/store.js';
import { createPool, getConnectionConfig } from '../core/connector.js';
import { captureSnapshot } from '../core/snapshot.js';
import { diffSnapshots } from '../core/differ.js';
import { generateForwardSQL } from '../core/generator.js';
import { runInTransaction } from '../core/transaction.js';

export async function restoreCommand(hash: string, tableName: string) {
  const config = getConnectionConfig();
  const pool = createPool(config);

  const spinner = ora(`Restoring table '${tableName}' to state at ${hash}...`).start();
  try {
    const targetSnapshot = loadSnapshot(loadCommit(hash).snapshotHash);
    const targetTable = targetSnapshot.tables[tableName];

    if (!targetTable) {
      throw new Error(`Table '${tableName}' not found in commit ${hash}.`);
    }

    const liveSnapshot = await captureSnapshot(pool, []);
    const liveTable = liveSnapshot.tables[tableName];

    const tempFromSnapshot = { tables: liveTable ? { [tableName]: liveTable } : {}, capturedAt: '', schemaHash: '' };
    const tempToSnapshot = { tables: { [tableName]: targetTable }, capturedAt: '', schemaHash: '' };

    const changeset = diffSnapshots(tempFromSnapshot, tempToSnapshot);
    const sqlStatements = generateForwardSQL(changeset);

    await runInTransaction(pool, sqlStatements);

    spinner.succeed(chalk.green(`Table '${tableName}' restored to state at ${hash}`));
    await pool.end();
  } catch (e: any) {
    spinner.fail(chalk.red(`Restore failed: ${e.message}`));
    process.exit(1);
  }
}
