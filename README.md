# DBGit

[![npm version](https://img.shields.io/npm/v/dbgit.svg)](https://www.npmjs.com/package/dbgit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)

"Git for your database schema — branch, diff, commit, rollback."

## Overview

DBGit is a production-ready, open-source CLI tool designed to bring the power of version control to your PostgreSQL database schema. It allows you to snapshot your schema, track changes over time, branch out for new features, and safely rollback to previous states.

<!-- demo.gif -->

## Installation

```bash
npm install -g dbgit
```

## Quick Start

1. **Configure your database connection:**

```bash
export DBGIT_DATABASE=mydb
export DBGIT_USER=postgres
export DBGIT_PASSWORD=secret
```

2. **Initialize DBGit:**

```bash
dbgit init
```

3. **Make your first commit:**

```bash
dbgit commit -m "initial schema"
```

4. **Iterate on your schema:**

```sql
-- In psql or your favorite SQL client
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
| `rollback <hash> [--safe] [--force] [--dry-run] [--soft-delete]` | Restore schema to a specific commit. |
| `branch [name] [--list]` | Create or list branches. |
| `checkout <ref>` | Switch branches or restore schema to a commit. |
| `restore <hash> <table>` | Restore a specific table to its state in a previous commit. |
| `merge <branch>` | Merge changes from another branch. |
| `doctor` | Check the health of your DBGit repository. |
| `restore-backup <hash>` | Get instructions on how to restore a physical backup. |

## Safety Model

DBGit is built with safety as a first-class citizen:

- **Schema Lock**: Uses PostgreSQL advisory locks to prevent concurrent schema operations.
- **Drift Detection**: Automatically detects if the database schema has changed outside of DBGit and aborts potentially dangerous operations.
- **Data Loss Protection**: In `prod` mode, destructive operations (like dropping tables or columns) are blocked unless `--force` or `--safe` (which creates a backup) is used.
- **Transactions**: All schema changes are executed within a single transaction. If any part fails, the entire operation is rolled back.
- **Soft Delete**: Use the `--soft-delete` flag to rename objects instead of dropping them.

## Storage Layout

DBGit stores its state in a `.dbgit/` directory in your project root:

```
.dbgit/
├── HEAD             # Current branch or commit
├── config           # Repository configuration
├── commits/         # Commit metadata (JSON)
├── snapshots/       # Schema snapshots (JSON)
├── branches/        # Branch definitions (JSON)
└── backups/         # pg_dump backups (.sql)
```

## Architecture

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

DBGit can be configured via environment variables or the `.dbgit/config` file.

| Variable | Default | Description |
| --- | --- | --- |
| `DBGIT_HOST` | `localhost` | Database host |
| `DBGIT_PORT` | `5432` | Database port |
| `DBGIT_DATABASE` | (Required) | Database name |
| `DBGIT_USER` | (Required) | Database user |
| `DBGIT_PASSWORD` | | Database password |
| `DBGIT_SSL` | `false` | Use SSL connection |

## .dbgitignore

Create a `.dbgitignore` file to ignore specific tables:

```text
# Ignore temporary tables
temp_*

# Ignore audit logs
audit_logs
```

## Known Limitations

- **PostgreSQL Only**: Currently only supports PostgreSQL.
- **Rename Detection**: Column/Table renames are detected as a DROP + ADD.
- **Schema**: Currently hardcoded to the `public` schema.

## Roadmap

- **Phase 1**: Core CLI and Schema Versioning (Done)
- **Phase 2**: Multi-schema support & improved rename detection
- **Phase 3**: Row-level diffing and data migrations
- **Phase 4**: Remote synchronization (S3/Cloud)

## Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT
