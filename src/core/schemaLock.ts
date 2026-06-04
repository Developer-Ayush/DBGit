import pg from 'pg';
import { query } from './connector.js';

// Simple hash function for the lock key
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

const LOCK_ID = hashCode('dbgit');

export async function acquireLock(pool: pg.Pool): Promise<void> {
  await query(pool, 'SELECT pg_advisory_lock($1)', [LOCK_ID]);
}

export async function releaseLock(pool: pg.Pool): Promise<void> {
  await query(pool, 'SELECT pg_advisory_unlock($1)', [LOCK_ID]);
}
