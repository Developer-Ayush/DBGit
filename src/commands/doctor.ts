import chalk from 'chalk';
import { isInitialized, getHead, loadCommit, loadSnapshot, loadConfig } from '../core/store.js';
import { createPool, getConnectionConfig } from '../core/connector.js';
import { listBackups } from '../core/backup.js';
import { captureSnapshot } from '../core/snapshot.js';
import { diffSnapshots } from '../core/differ.js';
import { computeSchemaHash } from '../core/validator.js';

export async function doctorCommand() {
  console.log(chalk.bold('\nDBGit Doctor Report\n'));

  const repoInit = isInitialized();
  console.log(`${repoInit ? chalk.green('✓') : chalk.red('✗')} Repository initialized`);

  if (!repoInit) {
    process.exit(1);
  }

  const config = getConnectionConfig();
  const pool = createPool(config);
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    console.log(`${chalk.green('✓')} Database connection: OK`);
    dbOk = true;
  } catch (e: any) {
    console.log(`${chalk.red('✗')} Database connection: FAILED (${e.message})`);
  }

  let riskScore = 0;
  const head = getHead();
  const dbConfig = loadConfig();

  if (dbOk) {
    const liveHash = await computeSchemaHash(pool, []);
    let drift = false;
    if (head.commit) {
      const lastCommit = loadCommit(head.commit);
      if (liveHash !== lastCommit.schemaHash) {
        drift = true;
        riskScore += 40;
      }
    }
    console.log(`Schema Drift:      ${drift ? chalk.red('DETECTED') : chalk.green('None')}`);

    const liveSnapshot = await captureSnapshot(pool, []);
    let oldSnapshot = { tables: {}, capturedAt: '', schemaHash: '' };
    if (head.commit) {
      oldSnapshot = loadSnapshot(loadCommit(head.commit).snapshotHash);
    }
    const changeset = diffSnapshots(oldSnapshot, liveSnapshot);
    console.log(`Untracked Changes: ${changeset.changes.length} changes`);
    if (changeset.changes.some(c => c.isDestructive)) {
        riskScore += 30;
    }
  }

  const backups = listBackups();
  console.log(`Backups:           ${backups.length > 0 ? chalk.green('Available (' + backups.length + ')') : chalk.yellow('Missing')}`);
  if (backups.length === 0) riskScore += 20;

  if (head.commit) {
    const lastCommit = loadCommit(head.commit);
    const lastCommitDate = new Date(lastCommit.timestamp);
    const daysSinceLastCommit = (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24);
    console.log(`Last Commit:       ${chalk.blue(lastCommit.commitHash)} — ${lastCommit.message} (${Math.floor(daysSinceLastCommit)} days ago)`);
    if (daysSinceLastCommit > 7) riskScore += 10;
  }

  let safety = 'High';
  if (riskScore > 30) safety = 'Medium';
  if (riskScore > 60) safety = 'Low';

  console.log(`Rollback Safety:   ${safety === 'High' ? chalk.green(safety) : safety === 'Medium' ? chalk.yellow(safety) : chalk.red(safety)}`);
  console.log(`Risk Score:        ${riskScore}/100`);

  console.log(chalk.bold('\nRecommendations:'));
  if (riskScore > 0) {
    if (riskScore >= 40) console.log('- Run \'dbgit commit\' to snapshot current changes and resolve drift');
    if (backups.length === 0) console.log('- Run \'dbgit rollback --safe\' on your next rollback to create a backup');
  } else {
    console.log('Your repository is in great shape!');
  }

  console.log('');
  await pool.end();
}
