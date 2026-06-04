import { SchemaSnapshot, TableSchema, Column, Index, Constraint, ForeignKey } from '../types/schema.js';
import { ChangeSet, Change, ChangeType } from '../types/changes.js';

export function diffSnapshots(from: SchemaSnapshot, to: SchemaSnapshot): ChangeSet {
  const changes: Change[] = [];

  const fromTables = Object.keys(from.tables);
  const toTables = Object.keys(to.tables);

  // Tables to drop
  for (const tableName of fromTables) {
    if (!to.tables[tableName]) {
      changes.push({
        type: ChangeType.DROP_TABLE,
        table: tableName,
        before: from.tables[tableName],
        isDestructive: true
      });
    }
  }

  // Tables to add or modify
  for (const tableName of toTables) {
    const fromTable = from.tables[tableName];
    const toTable = to.tables[tableName];

    if (!fromTable) {
      changes.push({
        type: ChangeType.ADD_TABLE,
        table: tableName,
        after: toTable,
        isDestructive: false
      });
      // All columns, indexes etc in this table are part of ADD_TABLE
      continue;
    }

    // Diff columns
    diffColumns(fromTable, toTable, changes);
    // Diff indexes
    diffIndexes(fromTable, toTable, changes);
    // Diff constraints
    diffConstraints(fromTable, toTable, changes);
    // Diff foreign keys
    diffForeignKeys(fromTable, toTable, changes);
  }

  return {
    changes,
    hasDestructive: changes.some(c => c.isDestructive)
  };
}

function diffColumns(from: TableSchema, to: TableSchema, changes: Change[]) {
  const fromCols = new Map(from.columns.map(c => [c.name, c]));
  const toCols = new Map(to.columns.map(c => [c.name, c]));

  for (const [name, col] of fromCols) {
    if (!toCols.has(name)) {
      changes.push({
        type: ChangeType.DROP_COLUMN,
        table: from.name,
        objectName: name,
        before: col,
        isDestructive: true
      });
    }
  }

  for (const [name, col] of toCols) {
    const fromCol = fromCols.get(name);
    if (!fromCol) {
      changes.push({
        type: ChangeType.ADD_COLUMN,
        table: to.name,
        objectName: name,
        after: col,
        isDestructive: false
      });
    } else if (fromCol.type !== col.type || fromCol.nullable !== col.nullable || fromCol.default !== col.default) {
      changes.push({
        type: ChangeType.MODIFY_COLUMN,
        table: to.name,
        objectName: name,
        before: fromCol,
        after: col,
        isDestructive: false // Usually not destructive, but can be
      });
    }
  }
}

function diffIndexes(from: TableSchema, to: TableSchema, changes: Change[]) {
  const fromIdx = new Map(from.indexes.map(i => [i.name, i]));
  const toIdx = new Map(to.indexes.map(i => [i.name, i]));

  for (const [name, idx] of fromIdx) {
    if (!toIdx.has(name)) {
      changes.push({
        type: ChangeType.DROP_INDEX,
        table: from.name,
        objectName: name,
        before: idx,
        isDestructive: false
      });
    }
  }

  for (const [name, idx] of toIdx) {
    const fromIdxObj = fromIdx.get(name);
    if (!fromIdxObj) {
      changes.push({
        type: ChangeType.ADD_INDEX,
        table: to.name,
        objectName: name,
        after: idx,
        isDestructive: false
      });
    } else if (JSON.stringify(fromIdxObj) !== JSON.stringify(idx)) {
      changes.push({
        type: ChangeType.DROP_INDEX,
        table: from.name,
        objectName: name,
        before: fromIdxObj,
        isDestructive: false
      });
      changes.push({
        type: ChangeType.ADD_INDEX,
        table: to.name,
        objectName: name,
        after: idx,
        isDestructive: false
      });
    }
  }
}

function diffConstraints(from: TableSchema, to: TableSchema, changes: Change[]) {
  const fromCons = new Map(from.constraints.map(c => [c.name, c]));
  const toCons = new Map(to.constraints.map(c => [c.name, c]));

  for (const [name, con] of fromCons) {
    if (!toCons.has(name)) {
      changes.push({
        type: ChangeType.DROP_CONSTRAINT,
        table: from.name,
        objectName: name,
        before: con,
        isDestructive: false
      });
    }
  }

  for (const [name, con] of toCons) {
    const fromCon = fromCons.get(name);
    if (!fromCon) {
      changes.push({
        type: ChangeType.ADD_CONSTRAINT,
        table: to.name,
        objectName: name,
        after: con,
        isDestructive: false
      });
    } else if (JSON.stringify(fromCon) !== JSON.stringify(con)) {
      changes.push({
        type: ChangeType.DROP_CONSTRAINT,
        table: from.name,
        objectName: name,
        before: fromCon,
        isDestructive: false
      });
      changes.push({
        type: ChangeType.ADD_CONSTRAINT,
        table: to.name,
        objectName: name,
        after: con,
        isDestructive: false
      });
    }
  }
}

function diffForeignKeys(from: TableSchema, to: TableSchema, changes: Change[]) {
  const fromFks = new Map(from.foreignKeys.map(f => [f.name, f]));
  const toFks = new Map(to.foreignKeys.map(f => [f.name, f]));

  for (const [name, fk] of fromFks) {
    if (!toFks.has(name)) {
      changes.push({
        type: ChangeType.DROP_FOREIGN_KEY,
        table: from.name,
        objectName: name,
        before: fk,
        isDestructive: true
      });
    }
  }

  for (const [name, fk] of toFks) {
    const fromFk = fromFks.get(name);
    if (!fromFk) {
      changes.push({
        type: ChangeType.ADD_FOREIGN_KEY,
        table: to.name,
        objectName: name,
        after: fk,
        isDestructive: false
      });
    } else if (JSON.stringify(fromFk) !== JSON.stringify(fk)) {
      changes.push({
        type: ChangeType.DROP_FOREIGN_KEY,
        table: from.name,
        objectName: name,
        before: fromFk,
        isDestructive: true
      });
      changes.push({
        type: ChangeType.ADD_FOREIGN_KEY,
        table: to.name,
        objectName: name,
        after: fk,
        isDestructive: false
      });
    }
  }
}
