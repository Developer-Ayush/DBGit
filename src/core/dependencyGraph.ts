import { ForeignKey, SchemaSnapshot } from '../types/schema.js';
import { Change, ChangeType } from '../types/changes.js';

export function orderForDeletion(tables: string[], foreignKeys: ForeignKey[]): string[] {
  // Kahn's algorithm for topological sort
  // For deletion, we want to delete tables that are NOT referenced by others first.
  // Dependencies: targetTable -> sourceTable (target must exist for source to exist)
  // For deletion: sourceTable must be deleted before targetTable if there is an FK from source to target.

  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  tables.forEach(t => {
    adj.set(t, []);
    inDegree.set(t, 0);
  });

  foreignKeys.forEach(fk => {
    if (adj.has(fk.sourceTable) && adj.has(fk.targetTable)) {
      adj.get(fk.sourceTable)!.push(fk.targetTable);
      inDegree.set(fk.targetTable, (inDegree.get(fk.targetTable) || 0) + 1);
    }
  });

  const queue: string[] = [];
  inDegree.forEach((degree, table) => {
    if (degree === 0) queue.push(table);
  });

  const result: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    result.push(u);

    adj.get(u)?.forEach(v => {
      inDegree.set(v, inDegree.get(v)! - 1);
      if (inDegree.get(v) === 0) queue.push(v);
    });
  }

  // Any tables not in result are part of a cycle (shouldn't happen with FKs normally)
  const remaining = tables.filter(t => !result.includes(t));
  return [...result, ...remaining];
}

export function orderForCreation(tables: string[], foreignKeys: ForeignKey[]): string[] {
  return orderForDeletion(tables, foreignKeys).reverse();
}

export function orderChanges(changes: Change[], snapshot: SchemaSnapshot): Change[] {
  // Order:
  // 1. DROP_FOREIGN_KEY
  // 2. DROP_CONSTRAINT
  // 3. DROP_INDEX
  // 4. DROP_COLUMN
  // 5. DROP_TABLE (topologically ordered)
  // 6. MODIFY_COLUMN
  // 7. ADD_TABLE (topologically ordered)
  // 8. ADD_COLUMN
  // 9. ADD_INDEX
  // 10. ADD_CONSTRAINT
  // 11. ADD_FOREIGN_KEY

  const dropFks = changes.filter(c => c.type === ChangeType.DROP_FOREIGN_KEY);
  const dropConstraints = changes.filter(c => c.type === ChangeType.DROP_CONSTRAINT);
  const dropIndexes = changes.filter(c => c.type === ChangeType.DROP_INDEX);
  const dropColumns = changes.filter(c => c.type === ChangeType.DROP_COLUMN);
  const dropTables = changes.filter(c => c.type === ChangeType.DROP_TABLE);
  const modifyColumns = changes.filter(c => c.type === ChangeType.MODIFY_COLUMN);
  const addTables = changes.filter(c => c.type === ChangeType.ADD_TABLE);
  const addColumns = changes.filter(c => c.type === ChangeType.ADD_COLUMN);
  const addIndexes = changes.filter(c => c.type === ChangeType.ADD_INDEX);
  const addConstraints = changes.filter(c => c.type === ChangeType.ADD_CONSTRAINT);
  const addFks = changes.filter(c => c.type === ChangeType.ADD_FOREIGN_KEY);

  // Topologically sort dropTables
  const allFks = Object.values(snapshot.tables).flatMap(t => t.foreignKeys);
  const dropTableNames = dropTables.map(c => c.table);
  const sortedDropTableNames = orderForDeletion(dropTableNames, allFks);
  const sortedDropTables = sortedDropTableNames.map(name => dropTables.find(c => c.table === name)!);

  // Topologically sort addTables
  const addTableNames = addTables.map(c => c.table);
  const sortedAddTableNames = orderForCreation(addTableNames, allFks);
  const sortedAddTables = sortedAddTableNames.map(name => addTables.find(c => c.table === name)!);

  return [
    ...dropFks,
    ...dropConstraints,
    ...dropIndexes,
    ...dropColumns,
    ...sortedDropTables,
    ...modifyColumns,
    ...sortedAddTables,
    ...addColumns,
    ...addIndexes,
    ...addConstraints,
    ...addFks
  ];
}
