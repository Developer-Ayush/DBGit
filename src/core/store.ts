import fs from 'fs';
import path from 'path';
import { Commit, Branch, HEAD } from '../types/commits.js';
import { SchemaSnapshot } from '../types/schema.js';

const DBGIT_DIR = path.join(process.cwd(), '.dbgit');
const COMMITS_DIR = path.join(DBGIT_DIR, 'commits');
const SNAPSHOTS_DIR = path.join(DBGIT_DIR, 'snapshots');
const BRANCHES_DIR = path.join(DBGIT_DIR, 'branches');
const BACKUPS_DIR = path.join(DBGIT_DIR, 'backups');
const HEAD_FILE = path.join(DBGIT_DIR, 'HEAD');
const CONFIG_FILE = path.join(DBGIT_DIR, 'config');

export function initStore(): void {
  if (!fs.existsSync(DBGIT_DIR)) fs.mkdirSync(DBGIT_DIR);
  if (!fs.existsSync(COMMITS_DIR)) fs.mkdirSync(COMMITS_DIR);
  if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR);
  if (!fs.existsSync(BRANCHES_DIR)) fs.mkdirSync(BRANCHES_DIR);
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR);
}

export function isInitialized(): boolean {
  return fs.existsSync(DBGIT_DIR);
}

export function saveCommit(commit: Commit): void {
  fs.writeFileSync(path.join(COMMITS_DIR, `${commit.commitHash}.json`), JSON.stringify(commit, null, 2));
}

export function loadCommit(hash: string): Commit {
  const filePath = path.join(COMMITS_DIR, `${hash}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`Commit ${hash} not found.`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function saveSnapshot(hash: string, snapshot: SchemaSnapshot): void {
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, `${hash}.json`), JSON.stringify(snapshot, null, 2));
}

export function loadSnapshot(hash: string): SchemaSnapshot {
  const filePath = path.join(SNAPSHOTS_DIR, `${hash}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`Snapshot ${hash} not found.`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getHead(): HEAD {
  if (!fs.existsSync(HEAD_FILE)) return { branch: 'main', commit: null };
  return JSON.parse(fs.readFileSync(HEAD_FILE, 'utf-8'));
}

export function setHead(head: HEAD): void {
  fs.writeFileSync(HEAD_FILE, JSON.stringify(head, null, 2));
}

export function saveBranch(branch: Branch): void {
  fs.writeFileSync(path.join(BRANCHES_DIR, `${branch.name}.json`), JSON.stringify(branch, null, 2));
}

export function loadBranch(name: string): Branch {
  const filePath = path.join(BRANCHES_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`Branch ${name} not found.`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function listBranches(): string[] {
  return fs.readdirSync(BRANCHES_DIR).map(f => f.replace('.json', ''));
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
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function loadConfig(): Record<string, string> {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

export function getBackupsDir(): string {
  return BACKUPS_DIR;
}
