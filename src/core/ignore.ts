import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';

export function loadIgnoreList(): string[] {
  const ignoreFile = path.join(process.cwd(), '.dbgitignore');
  if (!fs.existsSync(ignoreFile)) return [];

  return fs.readFileSync(ignoreFile, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

export function shouldIgnore(tableName: string, patterns: string[]): boolean {
  if (tableName.startsWith('_dbgit_deleted_')) return true;
  return patterns.some(pattern => minimatch(tableName, pattern));
}

export function isSoftDeleted(name: string): boolean {
  return name.startsWith('_dbgit_deleted_');
}
