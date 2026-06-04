import pg from 'pg';
const { Pool } = pg;
import { loadConfig } from './store.js';

export interface ConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  connectionString?: string;
}

export function getConnectionConfig(): ConnectionConfig {
  const storedConfig = loadConfig();

  // 1. DATABASE_URL
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  // 2. DBGIT_DATABASE_URL
  if (process.env.DBGIT_DATABASE_URL) {
    return { connectionString: process.env.DBGIT_DATABASE_URL };
  }

  // 3. .dbgit/config databaseUrl (if we support it there in the future, for now it might be in individual fields)
  if (storedConfig.databaseUrl) {
    return { connectionString: storedConfig.databaseUrl };
  }

  // 4. Legacy individual variables (Env first, then config)
  const host = process.env.DBGIT_HOST || storedConfig.DBGIT_HOST || 'localhost';
  const port = parseInt(process.env.DBGIT_PORT || storedConfig.DBGIT_PORT || '5432', 10);
  const database = process.env.DBGIT_DATABASE || storedConfig.DBGIT_DATABASE || '';
  const user = process.env.DBGIT_USER || storedConfig.DBGIT_USER || '';
  const password = process.env.DBGIT_PASSWORD || storedConfig.DBGIT_PASSWORD;
  const ssl = (process.env.DBGIT_SSL === 'true') || (storedConfig.DBGIT_SSL === 'true') || false;

  return { host, port, database, user, password, ssl };
}

export function createPool(config: ConnectionConfig): pg.Pool {
  if (config.connectionString) {
    return new Pool({ connectionString: config.connectionString });
  }

  if (!config.database || !config.user) {
    throw new Error('Database name and user are required. Set DATABASE_URL or individual DBGIT_* env vars.');
  }
  return new Pool(config as any);
}

export async function query<T>(pool: pg.Pool, sql: string, params?: unknown[]): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}
