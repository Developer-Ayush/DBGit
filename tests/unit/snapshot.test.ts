import { describe, it, expect, vi } from 'vitest';
import { captureSnapshot, hashSnapshot } from '../../src/core/snapshot.js';
import { Pool } from 'pg';

vi.mock('../../src/core/connector.js', () => ({
  query: vi.fn((pool, sql, params) => {
    if (sql.includes('information_schema.tables')) {
      return Promise.resolve([{ table_name: 'users' }]);
    }
    if (sql.includes('information_schema.columns')) {
      return Promise.resolve([
        { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null },
        { column_name: 'name', data_type: 'character varying', character_maximum_length: 255, is_nullable: 'YES', column_default: null }
      ]);
    }
    if (sql.includes('information_schema.table_constraints')) {
        return Promise.resolve([]);
    }
    if (sql.includes('pg_indexes')) {
        return Promise.resolve([]);
    }
    if (sql.includes('referential_constraints')) {
        return Promise.resolve([]);
    }
    return Promise.resolve([]);
  })
}));

describe('snapshot', () => {
  it('captures a snapshot correctly', async () => {
    const mockPool = {} as Pool;
    const snapshot = await captureSnapshot(mockPool, []);
    expect(snapshot.tables['users']).toBeDefined();
    expect(snapshot.tables['users'].columns).toHaveLength(2);
    expect(snapshot.tables['users'].columns[0].name).toBe('id');
    expect(snapshot.tables['users'].columns[1].type).toBe('character varying(255)');
  });

  it('generates a deterministic hash', () => {
    const snapshot1 = {
      tables: {
        users: { name: 'users', columns: [], indexes: [], constraints: [], foreignKeys: [] },
        posts: { name: 'posts', columns: [], indexes: [], constraints: [], foreignKeys: [] }
      },
      capturedAt: '2024-01-01T00:00:00Z',
      schemaHash: ''
    };
    const snapshot2 = {
      tables: {
        posts: { name: 'posts', columns: [], indexes: [], constraints: [], foreignKeys: [] },
        users: { name: 'users', columns: [], indexes: [], constraints: [], foreignKeys: [] }
      },
      capturedAt: '2024-01-01T00:01:00Z',
      schemaHash: ''
    };
    expect(hashSnapshot(snapshot1)).toBe(hashSnapshot(snapshot2));
  });
});
