import fs from 'fs';
import path from 'path';
import { Commit, Branch, HEAD } from '../types/commits.js';
import { SchemaSnapshot } from '../types/schema.js';

let repoRoot = process.cwd();

export function setRepoRoot(root: string): void {
  repoRoot = root;
}

export function getRepoRoot(): string {
  return repoRoot;
}

const getDbgitDir = () => path.join(getRepoRoot(), '.dbgit');
const getCommitsDir = () => path.join(getDbgitDir(), 'commits');
const getSnapshotsDir = () => path.join(getDbgitDir(), 'snapshots');
const getBranchesDir = () => path.join(getDbgitDir(), 'branches');
const getBackupsDirInternal = () => path.join(getDbgitDir(), 'backups');
const getHeadFile = () => path.join(getDbgitDir(), 'HEAD');
const getConfigFile = () => path.join(getDbgitDir(), 'config');

export function initStore(): void {
  const dbgitDir = getDbgitDir();
  if (!fs.existsSync(dbgitDir)) fs.mkdirSync(dbgitDir, { recursive: true });
  if (!fs.existsSync(getCommitsDir())) fs.mkdirSync(getCommitsDir(), { recursive: true });
  if (!fs.existsSync(getSnapshotsDir())) fs.mkdirSync(getSnapshotsDir(), { recursive: true });
  if (!fs.existsSync(getBranchesDir())) fs.mkdirSync(getBranchesDir(), { recursive: true });
  if (!fs.existsSync(getBackupsDirInternal())) fs.mkdirSync(getBackupsDirInternal(), { recursive: true });
}

export function isInitialized(): boolean {
  return fs.existsSync(getDbgitDir());
}

export function saveCommit(commit: Commit): void {
  fs.writeFileSync(path.join(getCommitsDir(), `${commit.commitHash}.json`), JSON.stringify(commit, null, 2));
}

export function loadCommit(hash: string): Commit {
  const filePath = path.join(getCommitsDir(), `${hash}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`Commit ${hash} not found.`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function saveSnapshot(hash: string, snapshot: SchemaSnapshot): void {
  fs.writeFileSync(path.join(getSnapshotsDir(), `${hash}.json`), JSON.stringify(snapshot, null, 2));
}

export function loadSnapshot(hash: string): SchemaSnapshot {
  const filePath = path.join(getSnapshotsDir(), `${hash}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`Snapshot ${hash} not found.`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getHead(): HEAD {
  const headFile = getHeadFile();
  if (!fs.existsSync(headFile)) return { branch: 'main', commit: null };
  return JSON.parse(fs.readFileSync(headFile, 'utf-8'));
}

export function setHead(head: HEAD): void {
  fs.writeFileSync(getHeadFile(), JSON.stringify(head, null, 2));
}

export function saveBranch(branch: Branch): void {
  fs.writeFileSync(path.join(getBranchesDir(), `${branch.name}.json`), JSON.stringify(branch, null, 2));
}

export function loadBranch(name: string): Branch {
  const filePath = path.join(getBranchesDir(), `${name}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`Branch ${name} not found.`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function listBranches(): string[] {
  return fs.readdirSync(getBranchesDir()).map(f => f.replace('.json', ''));
}

export function listCommits(branchName: string | null, headCommitHash: string | null): Commit[] {
  const commits: Commit[] = [];
  let currentHash = headCommitHash;

  if (!currentHash && branchName) {
    try {
      const branch = loadBranch(branchName);
      currentHash = branch.headCommit;
    } catch (e) {
      return [];
    }
  }

  while (currentHash) {
    const commit = loadCommit(currentHash);
    commits.push(commit);
    currentHash = commit.parent;
  }

  return commits;
}

export function saveConfig(config: Record<string, string>): void {
  fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2));
}

export function loadConfig(): Record<string, string> {
  const configFile = getConfigFile();
  if (!fs.existsSync(configFile)) return {};
  return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
}

export function getBackupsDir(): string {
  return getBackupsDirInternal();
}
