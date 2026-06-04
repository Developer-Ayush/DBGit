export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isPrimaryKey: boolean;
}

export interface Index {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
}

export interface Constraint {
  name: string;
  table: string;
  type: 'PRIMARY KEY' | 'UNIQUE' | 'CHECK' | 'FOREIGN KEY';
  definition: string;
}

export interface ForeignKey {
  name: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  onDelete: string;
  onUpdate: string;
}

export interface TableSchema {
  name: string;
  columns: Column[];
  indexes: Index[];
  constraints: Constraint[];
  foreignKeys: ForeignKey[];
}

export interface SchemaSnapshot {
  tables: Record<string, TableSchema>;
  capturedAt: string;  // ISO timestamp
  schemaHash: string;
}
