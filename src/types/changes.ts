export enum ChangeType {
  ADD_TABLE = 'ADD_TABLE',
  DROP_TABLE = 'DROP_TABLE',
  ADD_COLUMN = 'ADD_COLUMN',
  DROP_COLUMN = 'DROP_COLUMN',
  MODIFY_COLUMN = 'MODIFY_COLUMN',
  ADD_INDEX = 'ADD_INDEX',
  DROP_INDEX = 'DROP_INDEX',
  ADD_CONSTRAINT = 'ADD_CONSTRAINT',
  DROP_CONSTRAINT = 'DROP_CONSTRAINT',
  ADD_FOREIGN_KEY = 'ADD_FOREIGN_KEY',
  DROP_FOREIGN_KEY = 'DROP_FOREIGN_KEY',
}

export interface Change {
  type: ChangeType;
  table: string;
  objectName?: string;
  before?: unknown;
  after?: unknown;
  beforeTable?: unknown;
  afterTable?: unknown;
  isDestructive: boolean;
}

export interface ChangeSet {
  changes: Change[];
  hasDestructive: boolean;
}
