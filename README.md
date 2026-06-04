# DBGit

Git for your database schema.

**Branch. Diff. Commit. Rollback.**
*Without writing migration scripts.*

[![npm version](https://img.shields.io/npm/v/dbgit.svg)](https://www.npmjs.com/package/dbgit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)

> ⚠ **BETA SOFTWARE**: DBGit is currently in beta. Always test against staging databases first. DBGit modifies database schemas. Maintain backups before production use.

## What is DBGit?

DBGit brings the power of version control to your PostgreSQL database schema. Instead of manually managing migration files, DBGit tracks the *state* of your schema, allowing you to move between versions as easily as you switch branches in Git.

**Why doesn't PostgreSQL already have this?**
DBGit fills the gap between code versioning and database management, solving common pains like accidental `ALTER TABLE` calls, broken migrations, and the "fear of rollback."

## Quick Start

1. **Configure your database connection:**
   ```bash
   export DATABASE_URL=postgres://user:pass@localhost:5432/mydb
   ```

2. **Initialize DBGit:**
   ```bash
   dbgit init
   ```

3. **See what changed (Drift Detection):**
   ```bash
   # Add a column in your DB
   dbgit diff
   ```

4. **Commit your changes:**
   ```bash
   dbgit commit -m "add email column to users"
   ```

5. **Rollback safely:**
   ```bash
   dbgit rollback <commit-hash>
   ```

## Example Session

```bash
$ dbgit diff
  + column users.email character varying(255)

$ dbgit commit -m "add user emails"
✓ Commit a9f2d1b saved.
12 tables · 84 columns · 15 indexes
Branch: main

$ dbgit rollback a9f2d1b
┌ Rollback Risk: HIGH ────────────────┐
│                                     │
│   ⚠ DESTRUCTIVE CHANGES DETECTED   │
│                                     │
│   ✗ DROP_COLUMN: users.email        │
│     Impact: 1842 non-null rows      │
│                                     │
└─────────────────────────────────────┘
? Continue with destructive rollback? (y/N)
```

## Architecture

DBGit uses a snapshot-based approach to track your schema state.

```mermaid
graph TD
    A[Live Database] --> B[Snapshot Engine]
    B --> C[Diff Engine]
    C --> D[Commit Store]
    D --> E[Rollback Generator]
    E --> A
```

## Safety Model

DBGit is built for trust and reliability:

- **Transactions**: All operations run inside a `BEGIN/COMMIT` block. Failure triggers a full `ROLLBACK`.
- **Drift Detection**: DBGit detects if the live database has changed outside of DBGit and aborts dangerous operations for safety.
- **Impact Analysis**: Destructive operations (`DROP TABLE`, `DROP COLUMN`) show exact row counts and foreign key dependency warnings.
- **Soft Delete**: Use `--soft-delete` to rename objects (e.g., `_dbgit_deleted_users_1700000000`) instead of dropping them.
- **Backups**: In `prod` mode, destructive operations require `--safe` which forces a physical backup before proceeding.

## Rollback & Checkout Semantics

- **Rollback**: Follows `git revert` semantics. It creates a *new* commit that restores the schema to a previous state, preserving history.
- **Checkout**: Safely switches branches or HEAD. It **never** modifies the live database schema.

## Known Limitations

- **PostgreSQL Only**: Currently supports PostgreSQL (target version 12+).
- **Rename Detection**: Renames are currently detected as a DROP + ADD.
- **Public Schema**: Focuses on the `public` schema.

## Roadmap

- [ ] Support for multiple schemas
- [ ] Rename detection improvements
- [ ] Support for Views and Stored Procedures
- [ ] CI/CD integration helpers

## License

MIT
