import pg from 'pg';
const { Pool } = pg;
import { loadConfig } from './store.js';

export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl: boolean;
}

export function getConnectionConfig(): ConnectionConfig {
  let config: Partial<ConnectionConfig> = {};

  try {
    const storedConfig = loadConfig();
    config = {
      host: storedConfig.DBGIT_HOST || 'localhost',
      port: parseInt(storedConfig.DBGIT_PORT || '5432', 10),
      database: storedConfig.DBGIT_DATABASE,
      user: storedConfig.DBGIT_USER,
      password: storedConfig.DBGIT_PASSWORD,
      ssl: storedConfig.DBGIT_SSL === 'true',
    };
  } catch (e) {
    // Config not initialized yet, fall back to env vars
  }

  return {
    host: process.env.DBGIT_HOST || config.host || 'localhost',
    port: parseInt(process.env.DBGIT_PORT || config.port?.toString() || '5432', 10),
    database: process.env.DBGIT_DATABASE || config.database || '',
    user: process.env.DBGIT_USER || config.user || '',
    password: process.env.DBGIT_PASSWORD || config.password,
    ssl: (process.env.DBGIT_SSL === 'true') || config.ssl || false,
  };
}

export function createPool(config: ConnectionConfig): pg.Pool {
  if (!config.database || !config.user) {
    throw new Error('Database name and user are required. Set DBGIT_DATABASE and DBGIT_USER env vars.');
  }
  return new Pool(config);
}

export async function query<T>(pool: pg.Pool, sql: string, params?: unknown[]): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}
