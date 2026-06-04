# DBGit

[![npm version](https://img.shields.io/npm/v/dbgit.svg)](https://www.npmjs.com/package/dbgit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)

"Git for your database schema — branch, diff, commit, rollback."

> ⚠ **BETA WARNING**: DBGit is currently in beta. While we strive for stability, please test thoroughly in a staging environment before using it on production databases.

## Overview

DBGit is a production-ready, open-source CLI tool designed to bring the power of version control to your PostgreSQL database schema. It allows you to snapshot your schema, track changes over time, branch out for new features, and safely rollback to previous states.

## Installation

```bash
npm install -g dbgit
```

## Quick Start

1. **Configure your database connection:**

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/mydb
```

2. **Initialize DBGit:**

```bash
dbgit init --mode dev
```

3. **Make your first commit:**

```bash
dbgit commit -m "initial schema"
```

4. **Iterate on your schema:**

```sql
ALTER TABLE users ADD COLUMN email VARCHAR(255);
```

5. **See what changed:**

```bash
dbgit diff
```

6. **Commit the changes:**

```bash
dbgit commit -m "add email column to users"
```

7. **Rollback if needed:**

```bash
dbgit rollback <commit-hash> --safe
```

## Commands

| Command | Description |
| --- | --- |
| `init [--mode dev\|prod] [--recover]` | Initialize a new DBGit repository. |
| `commit -m <message>` | Snapshot the current database schema. |
| `diff` | Show changes between the last commit and the live database. |
| `log` | Show commit history. |
| `rollback <hash> [--safe] [--force] [--dry-run] [--soft-delete]` | Restore schema to a specific commit (creates a new commit). |
| `branch [name] [--list]` | Create or list branches. |
| `checkout <ref>` | Switch branches or update HEAD to a specific commit. |
| `purge` | Permanently remove soft-deleted objects (`_dbgit_deleted_*`). |
| `doctor` | Check the health of your DBGit repository and database. |
| `restore <hash> <table>` | Restore a specific table to its state in a previous commit. |
| `merge <branch>` | Merge changes from another branch. |
| `restore-backup <hash>` | Get instructions on how to restore a physical backup. |

## Safety Model

DBGit is built with safety as a first-class citizen:

- **Schema Lock**: Uses PostgreSQL advisory locks to prevent concurrent schema operations.
- **Drift Detection**: Automatically detects if the database schema has changed outside of DBGit and aborts potentially dangerous operations like `rollback`.
- **Data Loss Protection**: In `prod` mode, destructive operations (like dropping tables or columns) require `--safe` which forces a `pg_dump` backup before proceeding.
- **Transactions**: All schema changes are executed within a single transaction. If any part fails, the entire operation is rolled back.
- **Soft Delete**: Use the `--soft-delete` flag during rollback to rename objects (e.g., `_dbgit_deleted_users`) instead of dropping them.

## Rollback & Branch Semantics

- **Rollback**: Follows `git revert` semantics. It does not move `HEAD` backwards or rewrite history. Instead, it creates a *new* commit that restores the schema to the target state.
- **Checkout**: Safely switches the `HEAD` or current branch. It **does not** modify the live database schema. To change the schema, use `rollback`.
- **Branches**: Light-weight pointers to commits, similar to Git.

## Architecture

DBGit captures the logical state of your database (tables, columns, indexes, constraints, foreign keys) into JSON snapshots.

```
+-----------+       +-----------+       +-----------+
|    CLI    | ----> | Commands  | ----> |   Core    |
+-----------+       +-----------+       +-----------+
                                              |
                                              v
                                     +-----------------+
                                     |  PostgreSQL DB  |
                                     +-----------------+
```

## Configuration

DBGit looks for connection details in the following order:

1. `DATABASE_URL` environment variable
2. `DBGIT_DATABASE_URL` environment variable
3. `.dbgit/config` file
4. Legacy `DBGIT_HOST`, `DBGIT_PORT`, etc. environment variables

## .dbgitignore

Create a `.dbgitignore` file to ignore specific tables using glob patterns:

```text
# Ignore temporary tables
temp_*

# Ignore audit logs
audit_logs
```

## Known Limitations

- **PostgreSQL Only**: Currently only supports PostgreSQL.
- **Rename Detection**: Column/Table renames are detected as a DROP + ADD.
- **Public Schema**: Currently focused on the `public` schema.

## License

MIT
