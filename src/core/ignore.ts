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
  return patterns.some(pattern => minimatch(tableName, pattern));
}
