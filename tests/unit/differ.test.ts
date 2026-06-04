import { describe, it, expect } from 'vitest';
import { diffSnapshots } from '../../src/core/differ.js';
import { SchemaSnapshot } from '../../src/types/schema.js';
import { ChangeType } from '../../src/types/changes.js';

describe('differ', () => {
  it('detects ADD_TABLE', () => {
    const from: SchemaSnapshot = { tables: {}, capturedAt: '', schemaHash: '' };
    const to: SchemaSnapshot = {
      tables: {
        users: { name: 'users', columns: [], indexes: [], constraints: [], foreignKeys: [] }
      },
      capturedAt: '',
      schemaHash: ''
    };
    const diff = diffSnapshots(from, to);
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].type).toBe(ChangeType.ADD_TABLE);
  });

  it('detects ADD_COLUMN', () => {
    const from: SchemaSnapshot = {
      tables: {
        users: { name: 'users', columns: [], indexes: [], constraints: [], foreignKeys: [] }
      },
      capturedAt: '',
      schemaHash: ''
    };
    const to: SchemaSnapshot = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'id', type: 'int', nullable: false, default: null, isPrimaryKey: true }],
          indexes: [], constraints: [], foreignKeys: []
        }
      },
      capturedAt: '',
      schemaHash: ''
    };
    const diff = diffSnapshots(from, to);
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].type).toBe(ChangeType.ADD_COLUMN);
    expect(diff.changes[0].objectName).toBe('id');
  });
});
