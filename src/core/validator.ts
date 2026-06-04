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
    throw new Error("Database changed outside DBGit.\nRollback aborted.\nRun 'dbgit doctor' for details.");
  }
}
