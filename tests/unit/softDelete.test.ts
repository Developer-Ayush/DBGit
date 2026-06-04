import { describe, it, expect, vi } from 'vitest';
import { captureSnapshot } from '../../src/core/snapshot.js';
import { Pool } from 'pg';

vi.mock('../../src/core/connector.js', () => ({
  query: vi.fn((pool, sql, params) => {
    if (sql.includes('information_schema.tables')) {
      return Promise.resolve([
        { table_name: 'users' },
        { table_name: '_dbgit_deleted_old_table' }
      ]);
    }
    if (sql.includes('information_schema.columns')) {
      if (params && params[0] === 'users') {
        return Promise.resolve([
          { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null },
          { column_name: 'name', data_type: 'character varying', character_maximum_length: 255, is_nullable: 'YES', column_default: null },
          { column_name: '_dbgit_deleted_column', data_type: 'integer', is_nullable: 'YES', column_default: null }
        ]);
      }
    }
    return Promise.resolve([]);
  })
}));

describe('soft-delete audit', () => {
  it('ignores soft-deleted tables and columns in snapshots', async () => {
    const mockPool = {} as Pool;
    const snapshot = await captureSnapshot(mockPool, []);

    // Should NOT include _dbgit_deleted_old_table
    expect(snapshot.tables['users']).toBeDefined();
    expect(snapshot.tables['_dbgit_deleted_old_table']).toBeUndefined();

    // Should NOT include _dbgit_deleted_column in users table
    const userColumns = snapshot.tables['users'].columns;
    expect(userColumns.find(c => c.name === 'id')).toBeDefined();
    expect(userColumns.find(c => c.name === '_dbgit_deleted_column')).toBeUndefined();
  });
});
