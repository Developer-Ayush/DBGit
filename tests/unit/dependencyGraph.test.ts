import { describe, it, expect } from 'vitest';
import { orderForDeletion, orderForCreation } from '../../src/core/dependencyGraph.js';

describe('dependencyGraph', () => {
  it('orders tables for deletion correctly', () => {
    const tables = ['users', 'posts'];
    const fks = [{
      name: 'fk_user',
      sourceTable: 'posts',
      sourceColumn: 'user_id',
      targetTable: 'users',
      targetColumn: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    }];

    // posts depends on users, so posts must be deleted first
    const order = orderForDeletion(tables, fks as any);
    expect(order).toEqual(['posts', 'users']);
  });

  it('orders tables for creation correctly', () => {
    const tables = ['users', 'posts'];
    const fks = [{
      name: 'fk_user',
      sourceTable: 'posts',
      sourceColumn: 'user_id',
      targetTable: 'users',
      targetColumn: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    }];

    // users must be created before posts
    const order = orderForCreation(tables, fks as any);
    expect(order).toEqual(['users', 'posts']);
  });
});
