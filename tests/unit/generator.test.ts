import { describe, it, expect } from 'vitest';
import { generateForwardSQL, generateInverseSQL } from '../../src/core/generator.js';
import { ChangeType } from '../../src/types/changes.js';

describe('generator', () => {
  it('generates CREATE TABLE', () => {
    const changeset = {
      changes: [{
        type: ChangeType.ADD_TABLE,
        table: 'users',
        after: { name: 'users', columns: [{ name: 'id', type: 'int', nullable: false, default: null, isPrimaryKey: true }], indexes: [], constraints: [], foreignKeys: [] },
        isDestructive: false
      }],
      hasDestructive: false
    };
    const sql = generateForwardSQL(changeset as any);
    expect(sql[0]).toBe('CREATE TABLE users (id int NOT NULL PRIMARY KEY)');
  });

  it('generates inverse DROP TABLE', () => {
    const changeset = {
      changes: [{
        type: ChangeType.ADD_TABLE,
        table: 'users',
        after: { name: 'users', columns: [], indexes: [], constraints: [], foreignKeys: [] },
        isDestructive: false
      }],
      hasDestructive: false
    };
    const sql = generateInverseSQL(changeset as any);
    expect(sql[0]).toBe('DROP TABLE users');
  });
});
