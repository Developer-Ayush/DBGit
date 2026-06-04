import { ChangeSet, Change, ChangeType } from '../types/changes.js';
import { TableSchema, Column, Index, Constraint, ForeignKey } from '../types/schema.js';

export function generateForwardSQL(changeset: ChangeSet): string[] {
  return changeset.changes.flatMap(change => generateChangeSQL(change, false));
}

export function generateInverseSQL(changeset: ChangeSet): string[] {
  // To generate inverse, we process changes in reverse order
  // and flip the operations.
  return [...changeset.changes]
    .reverse()
    .flatMap(change => generateChangeSQL(change, true));
}

function generateChangeSQL(change: Change, inverse: boolean): string[] {
  const type = inverse ? flipType(change.type) : change.type;

  switch (type) {
    case ChangeType.ADD_TABLE: {
      const table = (inverse ? change.before : change.after) as TableSchema;
      const columnsSql = table.columns.map(renderColumn).join(', ');
      let sql = `CREATE TABLE ${table.name} (${columnsSql})`;
      return [sql];
    }
    case ChangeType.DROP_TABLE:
      return [`DROP TABLE ${change.table}`];

    case ChangeType.ADD_COLUMN: {
      const col = (inverse ? change.before : change.after) as Column;
      return [`ALTER TABLE ${change.table} ADD COLUMN ${renderColumn(col)}`];
    }
    case ChangeType.DROP_COLUMN:
      return [`ALTER TABLE ${change.table} DROP COLUMN ${change.objectName}`];

    case ChangeType.MODIFY_COLUMN: {
      const col = (inverse ? change.before : change.after) as Column;
      const statements = [];
      statements.push(`ALTER TABLE ${change.table} ALTER COLUMN ${change.objectName} TYPE ${col.type} USING ${change.objectName}::${col.type}`);
      if (col.nullable) {
        statements.push(`ALTER TABLE ${change.table} ALTER COLUMN ${change.objectName} DROP NOT NULL`);
      } else {
        statements.push(`ALTER TABLE ${change.table} ALTER COLUMN ${change.objectName} SET NOT NULL`);
      }
      if (col.default) {
        statements.push(`ALTER TABLE ${change.table} ALTER COLUMN ${change.objectName} SET DEFAULT ${col.default}`);
      } else {
        statements.push(`ALTER TABLE ${change.table} ALTER COLUMN ${change.objectName} DROP DEFAULT`);
      }
      return statements;
    }

    case ChangeType.ADD_INDEX: {
      const idx = (inverse ? change.before : change.after) as Index;
      const unique = idx.unique ? 'UNIQUE ' : '';
      return [`CREATE ${unique}INDEX ${idx.name} ON ${idx.table} (${idx.columns.join(', ')})`];
    }
    case ChangeType.DROP_INDEX:
      return [`DROP INDEX ${change.objectName}`];

    case ChangeType.ADD_CONSTRAINT: {
      const con = (inverse ? change.before : change.after) as Constraint;
      // Note: definition is expected to be something like "CHECK (price > 0)"
      let typeClause = con.type;
      if (con.type === 'PRIMARY KEY') {
        const table = (inverse ? change.beforeTable : change.afterTable) as TableSchema;
        const pkCols = table?.columns.filter(c => c.isPrimaryKey).map(c => c.name).join(', ');
        if (pkCols) {
           return [`ALTER TABLE ${change.table} ADD CONSTRAINT ${con.name} PRIMARY KEY (${pkCols})`];
        }
      }
      return [`ALTER TABLE ${change.table} ADD CONSTRAINT ${con.name} ${typeClause} ${con.definition}`];
    }
    case ChangeType.DROP_CONSTRAINT:
      return [`ALTER TABLE ${change.table} DROP CONSTRAINT ${change.objectName}`];

    case ChangeType.ADD_FOREIGN_KEY: {
      const fk = (inverse ? change.before : change.after) as ForeignKey;
      return [`ALTER TABLE ${change.table} ADD CONSTRAINT ${fk.name} FOREIGN KEY (${fk.sourceColumn}) REFERENCES ${fk.targetTable}(${fk.targetColumn}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`];
    }
    case ChangeType.DROP_FOREIGN_KEY:
      return [`ALTER TABLE ${change.table} DROP CONSTRAINT ${change.objectName}`];

    default:
      return [];
  }
}

function renderColumn(col: Column): string {
  let sql = `${col.name} ${col.type}`;
  if (!col.nullable) sql += ' NOT NULL';
  if (col.default) sql += ` DEFAULT ${col.default}`;
  if (col.isPrimaryKey) sql += ' PRIMARY KEY';
  return sql;
}

function flipType(type: ChangeType): ChangeType {
  switch (type) {
    case ChangeType.ADD_TABLE: return ChangeType.DROP_TABLE;
    case ChangeType.DROP_TABLE: return ChangeType.ADD_TABLE;
    case ChangeType.ADD_COLUMN: return ChangeType.DROP_COLUMN;
    case ChangeType.DROP_COLUMN: return ChangeType.ADD_COLUMN;
    case ChangeType.ADD_INDEX: return ChangeType.DROP_INDEX;
    case ChangeType.DROP_INDEX: return ChangeType.ADD_INDEX;
    case ChangeType.ADD_CONSTRAINT: return ChangeType.DROP_CONSTRAINT;
    case ChangeType.DROP_CONSTRAINT: return ChangeType.ADD_CONSTRAINT;
    case ChangeType.ADD_FOREIGN_KEY: return ChangeType.DROP_FOREIGN_KEY;
    case ChangeType.DROP_FOREIGN_KEY: return ChangeType.ADD_FOREIGN_KEY;
    case ChangeType.MODIFY_COLUMN: return ChangeType.MODIFY_COLUMN;
    default: return type;
  }
}
