import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ConnectionConfig } from './connector.js';
import { getBackupsDir } from './store.js';

export async function createBackup(hash: string, config: ConnectionConfig): Promise<string> {
  const backupDir = path.join(getBackupsDir(), hash);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = path.join(backupDir, 'backup.sql');

  const env = {
    ...process.env,
    PGPASSWORD: config.password
  };

  const command = `pg_dump -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -f "${backupFile}"`;

  try {
    execSync(command, { env, stdio: 'pipe' });
    return backupFile;
  } catch (error: any) {
    if (error.message.includes('pg_dump: not found') || error.message.includes('command not found')) {
      console.warn("pg_dump not found. Install PostgreSQL client tools and ensure pg_dump is in your PATH. Skipping backup.");
      return '';
    }
    throw error;
  }
}

export function listBackups(): string[] {
  const backupsDir = getBackupsDir();
  if (!fs.existsSync(backupsDir)) return [];
  return fs.readdirSync(backupsDir);
}

export function backupExists(hash: string): boolean {
  return fs.existsSync(path.join(getBackupsDir(), hash, 'backup.sql'));
}

export function getRestoreCommand(hash: string, config: ConnectionConfig): string {
  const backupFile = path.join(getBackupsDir(), hash, 'backup.sql');
  return `psql -h ${config.host} -p ${config.port} -U ${config.user} -d ${config.database} -f "${backupFile}"`;
}
