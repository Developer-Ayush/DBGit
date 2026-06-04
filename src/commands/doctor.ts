import chalk from 'chalk';
import boxen from 'boxen';
import { isInitialized, getHead, loadCommit, loadSnapshot, loadConfig } from '../core/store.js';
import { createPool, getConnectionConfig, query } from '../core/connector.js';
import { listBackups } from '../core/backup.js';
import { captureSnapshot } from '../core/snapshot.js';
import { diffSnapshots } from '../core/differ.js';
import { computeSchemaHash } from '../core/validator.js';
import { loadIgnoreList } from '../core/ignore.js';

export async function doctorCommand() {
  const repoInit = isInitialized();

  if (!repoInit) {
    console.log(chalk.red('\n✗ DBGit is not initialized in this directory.'));
    console.log(chalk.yellow('Recommendation: Run \'dbgit init\' to initialize the repository.'));
    process.exit(1);
  }

  let report = '';
  report += `${chalk.green('✓')} Repository initialized\n`;

  const ignoreList = loadIgnoreList();
  const config = getConnectionConfig();
  const pool = createPool(config);
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    report += `${chalk.green('✓')} Database connection: OK\n`;
    dbOk = true;
  } catch (e: any) {
    report += `${chalk.red('✗')} Database connection: FAILED (${e.message})\n`;
  }

  let riskScore = 0;
  const head = getHead();
  const dbConfig = loadConfig();
  let drift = false;
  let softDeletedCount = 0;
  let hasPgDump = true; // We'll check this by trying to run it later if needed, but for now assume true

  if (dbOk) {
    const liveHash = await computeSchemaHash(pool, ignoreList);
    if (head.commit) {
      const lastCommit = loadCommit(head.commit);
      if (liveHash !== lastCommit.schemaHash) {
        drift = true;
        riskScore += 40;
      }
    }
    report += `Schema Drift:      ${drift ? chalk.red('DETECTED') : chalk.green('None')}\n`;

    const liveSnapshot = await captureSnapshot(pool, ignoreList);
    let oldSnapshot = { tables: {}, capturedAt: '', schemaHash: '' };
    if (head.commit) {
      oldSnapshot = loadSnapshot(loadCommit(head.commit).snapshotHash);
    }
    const changeset = diffSnapshots(oldSnapshot, liveSnapshot);
    report += `Untracked Changes: ${changeset.changes.length} changes\n`;
    if (changeset.changes.some(c => c.isDestructive)) {
        riskScore += 30;
    }

    const softDeletedTables = await query(pool, "SELECT table_name FROM information_schema.tables WHERE table_name LIKE '_dbgit_deleted_%'");
    const softDeletedColumns = await query(pool, "SELECT column_name FROM information_schema.columns WHERE column_name LIKE '_dbgit_deleted_%'");
    softDeletedCount = softDeletedTables.length + softDeletedColumns.length;
    report += `Soft Deleted:      ${softDeletedCount > 0 ? chalk.yellow(softDeletedCount + ' objects') : chalk.green('None')}\n`;
  }

  const backups = listBackups();
  report += `Backups:           ${backups.length > 0 ? chalk.green('Available (' + backups.length + ')') : chalk.yellow('Missing')}\n`;
  if (backups.length === 0) riskScore += 20;

  if (head.commit) {
    const lastCommit = loadCommit(head.commit);
    const lastCommitDate = new Date(lastCommit.timestamp);
    const daysSinceLastCommit = (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24);
    report += `Last Commit:       ${chalk.blue(lastCommit.commitHash)} — ${lastCommit.message} (${Math.floor(daysSinceLastCommit)} days ago)\n`;
    if (daysSinceLastCommit > 7) riskScore += 10;
  }

  let safety = 'High';
  if (riskScore > 30) safety = 'Medium';
  if (riskScore > 60) safety = 'Low';

  report += `Rollback Safety:   ${safety === 'High' ? chalk.green(safety) : safety === 'Medium' ? chalk.yellow(safety) : chalk.red(safety)}\n`;
  report += `Risk Score:        ${riskScore}/100\n`;

  console.log(boxen(report.trim(), { padding: 1, borderColor: 'cyan', title: 'DBGit Doctor Report' }));

  console.log(chalk.bold('\nℹ Recommendations:'));
  const recommendations: string[] = [];

  if (drift) {
    recommendations.push(chalk.yellow('- Schema Drift Detected: Run \'dbgit commit\' to capture current schema changes and resolve drift.'));
  }
  if (dbOk && !drift && head.commit) {
    // Check if there are untracked changes that AREN'T drift (this shouldn't happen if drift check is correct, but good for clarity)
  }
  if (backups.length === 0) {
    recommendations.push(chalk.yellow('- Missing Backups: Run \'dbgit rollback --safe\' on your next rollback to enable backup and restore support.'));
  }
  if (softDeletedCount > 0) {
    recommendations.push(chalk.yellow(`- Soft Deleted Objects Exist: Run 'dbgit purge' to permanently remove ${softDeletedCount} archived objects.`));
  }
  if (riskScore > 50) {
    recommendations.push(chalk.red('- Rollback Risk: High risk detected. Always use --safe before destructive rollbacks.'));
  }

  // Check for pg_dump availability
  try {
    const { execSync } = await import('child_process');
    execSync('pg_dump --version', { stdio: 'ignore' });
  } catch (e) {
    recommendations.push(chalk.red('- Missing pg_dump: Install PostgreSQL client tools to enable safe rollback and backup functionality.'));
  }

  if (recommendations.length === 0) {
    console.log(chalk.green('  ✓ Your repository is in great shape!'));
  } else {
    recommendations.forEach(rec => console.log('  ' + rec));
  }

  console.log('');
  await pool.end();
}
