#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { commitCommand } from './commands/commit.js';
import { diffCommand } from './commands/diff.js';
import { logCommand } from './commands/log.js';
import { rollbackCommand } from './commands/rollback.js';
import { branchCommand } from './commands/branch.js';
import { checkoutCommand } from './commands/checkout.js';
import { restoreCommand } from './commands/restore.js';
import { mergeCommand } from './commands/merge.js';
import { doctorCommand } from './commands/doctor.js';
import { restoreBackupCommand } from './commands/restore-backup.js';

const program = new Command();

program
  .name('dbgit')
  .description('Git for your database schema — branch, diff, commit, rollback.')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new DBGit repository')
  .option('--mode <mode>', 'Environment mode (dev|prod)', 'dev')
  .option('--recover', 'Recover state from live database')
  .action(async (options) => {
    try {
      await initCommand(options);
    } catch (e: any) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
  });

program
  .command('commit')
  .description('Snapshot the current database schema')
  .requiredOption('-m, --message <message>', 'Commit message')
  .action(async (options) => {
    try {
      await commitCommand(options);
    } catch (e: any) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
  });

program
  .command('diff')
  .description('Show changes between last commit and live database')
  .action(async () => {
    try {
      await diffCommand();
    } catch (e: any) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
  });

program
  .command('log')
  .description('Show commit logs')
  .action(() => {
    try {
      logCommand();
    } catch (e: any) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
  });

program
  .command('rollback <hash>')
  .description('Rollback database schema to a specific commit')
  .option('--safe', 'Create a backup before rolling back')
  .option('--force', 'Force destructive operations (required in prod mode)')
  .option('--dry-run', 'Show SQL statements without executing them')
  .option('--soft-delete', 'Rename dropped objects instead of deleting them')
  .action(async (hash, options) => {
    try {
      await rollbackCommand(hash, options);
    } catch (e: any) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
  });

program
  .command('branch [name]')
  .description('List or create branches')
  .option('--list', 'List all branches')
  .action((name, options) => {
    try {
      branchCommand(name, options);
    } catch (e: any) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
  });

program
  .command('checkout <ref>')
  .description('Switch branches or restore database to a specific commit')
  .action(async (ref) => {
    try {
      await checkoutCommand(ref);
    } catch (e: any) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
  });

program
  .command('restore <hash> <table>')
  .description('Restore a specific table to its state in a previous commit')
  .action(async (hash, table) => {
    try {
      await restoreCommand(hash, table);
    } catch (e: any) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
  });

program
  .command('merge <branch>')
  .description('Merge changes from another branch into the current branch')
  .action(async (branch) => {
    try {
      await mergeCommand(branch);
    } catch (e: any) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Check health of DBGit repository and database connection')
  .action(async () => {
    try {
      await doctorCommand();
    } catch (e: any) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
  });

program
  .command('restore-backup <hash>')
  .description('Print command to manually restore a backup')
  .action((hash) => {
    try {
      restoreBackupCommand(hash);
    } catch (e: any) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
  });

program.parse(process.argv);
