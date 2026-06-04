import pg from 'pg';
import { Commit } from '../types/commits.js';
import { captureSnapshot } from './snapshot.js';

export async function computeSchemaHash(pool: pg.Pool, ignoreList: string[]): Promise<string> {
  const snapshot = await captureSnapshot(pool, ignoreList);
  return snapshot.schemaHash;
}

export async function validateSchemaNotDrifted(pool: pg.Pool, commit: Commit, ignoreList: string[]): Promise<void> {
  const currentHash = await computeSchemaHash(pool, ignoreList);
  if (currentHash !== commit.schemaHash) {
    throw new Error(`Schema drift detected.
Database has been modified outside of DBGit since the last commit.
HEAD: ${commit.schemaHash.substring(0, 8)}
Live: ${currentHash.substring(0, 8)}

Rollback aborted for safety.
If you want to keep live changes, 'dbgit commit' them first.
If you want to discard them, you may need to manually sync or use --force (not recommended).`);
  }
}
