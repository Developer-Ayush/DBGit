import chalk from 'chalk';
import { getRestoreCommand, backupExists } from '../core/backup.js';
import { getConnectionConfig } from '../core/connector.js';

export function restoreBackupCommand(hash: string) {
  const config = getConnectionConfig();

  if (!backupExists(hash)) {
    console.error(chalk.red(`Error: No backup found for commit ${hash}.`));
    process.exit(1);
  }

  const command = getRestoreCommand(hash, config);
  console.log(chalk.green('\nTo restore the backup, run the following command manually:'));
  console.log(chalk.cyan(`\n  ${command}\n`));
  console.log(chalk.yellow('Warning: This will overwrite data in your database.'));
}
