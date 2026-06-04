import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { isInitialized, loadConfig } from '../core/store.js';
import { createPool, getConnectionConfig, query } from '../core/connector.js';
import { runInTransaction } from '../core/transaction.js';

export async function purgeCommand() {
  if (!isInitialized()) {
    console.error(chalk.red("Not a DBGit repository. Run 'dbgit init' first."));
    process.exit(1);
  }

  const config = getConnectionConfig();
  const pool = createPool(config);
  const dbConfig = loadConfig();
  const isProd = dbConfig.DBGIT_MODE === 'prod';

  try {
    const spinner = ora('Scanning for soft-deleted objects...').start();

    // Find soft-deleted tables
    const deletedTables = await query<{ table_name: string }>(pool, `
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE '_dbgit_deleted_%'
    `);

    // Find soft-deleted columns
    const deletedColumns = await query<{ table_name: string, column_name: string }>(pool, `
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name LIKE '_dbgit_deleted_%'
    `);

    spinner.stop();

    if (deletedTables.length === 0 && deletedColumns.length === 0) {
      console.log(chalk.green('✓ No soft-deleted objects found.'));
      await pool.end();
      return;
    }

    console.log(chalk.yellow('ℹ Objects scheduled for permanent removal:'));
    if (deletedTables.length > 0) {
      console.log(chalk.red('\nTables:'));
      deletedTables.forEach(t => console.log(chalk.red(`  ${t.table_name}`)));
    }
    if (deletedColumns.length > 0) {
      console.log(chalk.red('\nColumns:'));
      deletedColumns.forEach(c => console.log(chalk.red(`  ${c.table_name}.${c.column_name}`)));
    }

    if (isProd) {
      console.warn(chalk.bgRed.white('\n WARNING: Production mode. Permanent deletion of data. '));
    }

    const response = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to permanently delete these objects?',
      initial: false
    });

    if (!response.confirm) {
      console.log(chalk.gray('Purge aborted.'));
      await pool.end();
      return;
    }

    if (isProd) {
      const doubleCheck = await prompts({
        type: 'text',
        name: 'confirm',
        message: 'Type PURGE to confirm permanent deletion:'
      });
      if (doubleCheck.confirm !== 'PURGE') {
        console.log(chalk.gray('Purge aborted.'));
        await pool.end();
        return;
      }
    }

    const sqlStatements: string[] = [];
    deletedColumns.forEach(c => {
      sqlStatements.push(`ALTER TABLE ${c.table_name} DROP COLUMN ${c.column_name}`);
    });
    deletedTables.forEach(t => {
      sqlStatements.push(`DROP TABLE ${t.table_name}`);
    });

    const purgeSpinner = ora('Purging objects...').start();
    await runInTransaction(pool, sqlStatements);
    purgeSpinner.succeed(chalk.green('Purge complete. Soft-deleted objects permanently removed.'));

    await pool.end();
  } catch (e: any) {
    console.error(chalk.red(`Purge failed: ${e.message}`));
    process.exit(1);
  }
}
