import chalk from 'chalk';
import ora from 'ora';
import { initStore, isInitialized, setHead, saveBranch, saveConfig, saveCommit, saveSnapshot } from '../core/store.js';
import { createPool, getConnectionConfig } from '../core/connector.js';
import { captureSnapshot } from '../core/snapshot.js';
import crypto from 'crypto';
import { Commit } from '../types/commits.js';

export async function initCommand(options: { mode: string, recover: boolean }) {
  if (isInitialized() && !options.recover) {
    console.error(chalk.red('Error: .dbgit/ already exists. Use --recover to reconstruct state.'));
    process.exit(1);
  }

  initStore();

  const config = getConnectionConfig();
  saveConfig({
    DBGIT_MODE: options.mode,
    DBGIT_HOST: config.host,
    DBGIT_PORT: config.port.toString(),
    DBGIT_DATABASE: config.database,
    DBGIT_USER: config.user,
    DBGIT_SSL: config.ssl.toString(),
  });

  if (options.recover) {
    const spinner = ora('Recovering state from live database...').start();
    try {
      const pool = createPool(config);
      const snapshot = await captureSnapshot(pool, []);

      const timestamp = new Date().toISOString();
      const message = "Recovered initial state";
      const commitHash = crypto.createHash('sha256').update(message + timestamp + snapshot.schemaHash).digest('hex');

      const commit: Commit = {
        commitHash,
        snapshotHash: snapshot.schemaHash,
        parent: null,
        timestamp,
        message,
        branch: 'main',
        schemaHash: snapshot.schemaHash
      };

      saveSnapshot(snapshot.schemaHash, snapshot);
      saveCommit(commit);
      saveBranch({
        name: 'main',
        headCommit: commitHash,
        createdAt: timestamp,
        basedOn: null
      });
      setHead({ branch: 'main', commit: commitHash });

      spinner.succeed(chalk.green('Recovered DBGit state from live database.'));
      await pool.end();
    } catch (e: any) {
      spinner.fail(chalk.red(`Recovery failed: ${e.message}`));
      process.exit(1);
    }
  } else {
    saveBranch({
      name: 'main',
      headCommit: '',
      createdAt: new Date().toISOString(),
      basedOn: null
    });
    setHead({ branch: 'main', commit: null });

    console.log(chalk.green('Initialized DBGit repository.'));
  }

  console.log(chalk.blue(`Connected to: ${config.database}@${config.host}`));
  if (options.mode === 'prod') {
    console.warn(chalk.yellow('Production mode: destructive operations require --force'));
  }
}
