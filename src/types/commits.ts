export interface Commit {
  commitHash: string;
  snapshotHash: string;
  parent: string | null;
  timestamp: string;
  message: string;
  branch: string | null;
  schemaHash: string;
}

export interface Branch {
  name: string;
  headCommit: string;
  createdAt: string;
  basedOn: string | null;
}

export interface HEAD {
  branch: string | null;
  commit: string | null;
}
