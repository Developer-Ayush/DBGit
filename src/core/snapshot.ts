import crypto from 'crypto';
import pg from 'pg';
import { SchemaSnapshot, TableSchema, Column, Index, Constraint, ForeignKey } from '../types/schema.js';
import { query } from './connector.js';
import { shouldIgnore } from './ignore.js';

export async function captureSnapshot(pool: pg.Pool, ignoreList: string[]): Promise<SchemaSnapshot> {
  const tables: Record<string, TableSchema> = {};

  const tableRows = await query<{ table_name: string }>(pool, `
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);

  for (const tableRow of tableRows) {
    const tableName = tableRow.table_name;
    if (shouldIgnore(tableName, ignoreList)) continue;

    const columns = await query<any>(pool, `
      SELECT column_name, data_type, character_maximum_length,
             is_nullable, column_default, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    const primaryKeys = await query<{ column_name: string }>(pool, `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
    `, [tableName]);

    const pkColumns = new Set(primaryKeys.map(pk => pk.column_name));

    const indexes = await query<any>(pool, `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = $1
    `, [tableName]);

    const constraints = await query<any>(pool, `
      SELECT tc.constraint_name, tc.constraint_type, cc.check_clause
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = $1
      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK')
    `, [tableName]);

    const foreignKeys = await query<any>(pool, `
      SELECT
        kcu.constraint_name,
        kcu.column_name as source_column,
        ccu.table_name as target_table,
        ccu.column_name as target_column,
        rc.delete_rule as on_delete,
        rc.update_rule as on_update
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.referential_constraints rc
        ON kcu.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name = ccu.constraint_name
      WHERE kcu.table_schema = 'public' AND kcu.table_name = $1
    `, [tableName]);

    tables[tableName] = {
      name: tableName,
      columns: columns
        .filter((c: any) => !c.column_name.startsWith('_dbgit_deleted_'))
        .map((c: any) => ({
          name: c.column_name,
          type: c.character_maximum_length ? `${c.data_type}(${c.character_maximum_length})` : c.data_type,
          nullable: c.is_nullable === 'YES',
          default: c.column_default,
          isPrimaryKey: pkColumns.has(c.column_name)
        })),
      indexes: indexes.map((i: any) => {
        // Extract columns from indexdef: "CREATE UNIQUE INDEX idx_name ON table USING btree (col1, col2)"
        const match = i.indexdef.match(/\((.*)\)/);
        const cols = match ? match[1].split(',').map((s: string) => s.trim()) : [];
        return {
          name: i.indexname,
          table: tableName,
          columns: cols,
          unique: i.indexdef.includes('UNIQUE')
        };
      }),
      constraints: constraints.map((c: any) => ({
        name: c.constraint_name,
        table: tableName,
        type: c.constraint_type,
        definition: c.check_clause || '' // Simplification, standard definition is harder to get exactly
      })),
      foreignKeys: foreignKeys.map((fk: any) => ({
        name: fk.constraint_name,
        sourceTable: tableName,
        sourceColumn: fk.source_column,
        targetTable: fk.target_table,
        targetColumn: fk.target_column,
        onDelete: fk.on_delete,
        onUpdate: fk.on_update
      }))
    };
  }

  const snapshot: SchemaSnapshot = {
    tables,
    capturedAt: new Date().toISOString(),
    schemaHash: ''
  };

  snapshot.schemaHash = hashSnapshot(snapshot);
  return snapshot;
}

export function hashSnapshot(snapshot: SchemaSnapshot): string {
  const sortedTables = Object.keys(snapshot.tables).sort().reduce((acc, key) => {
    const table = snapshot.tables[key];
    acc[key] = {
      ...table,
      columns: [...table.columns].sort((a, b) => a.name.localeCompare(b.name)),
      indexes: [...table.indexes].sort((a, b) => a.name.localeCompare(b.name)),
      constraints: [...table.constraints].sort((a, b) => a.name.localeCompare(b.name)),
      foreignKeys: [...table.foreignKeys].sort((a, b) => a.name.localeCompare(b.name)),
    };
    return acc;
  }, {} as any);

  const data = JSON.stringify(sortedTables);
  return crypto.createHash('sha256').update(data).digest('hex');
}
