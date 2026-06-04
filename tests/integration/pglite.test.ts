import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import prompts from 'prompts';
import { initCommand } from '../../src/commands/init.js';
import { commitCommand } from '../../src/commands/commit.js';
import { rollbackCommand } from '../../src/commands/rollback.js';
import { diffSnapshots } from '../../src/core/differ.js';
import { captureSnapshot } from '../../src/core/snapshot.js';
import * as store from '../../src/core/store.js';
import * as connector from '../../src/core/connector.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Real PostgreSQL Integration (via PGlite)', () => {
    let pg: PGlite;
    let tempDir: string;

    beforeEach(async () => {
        pg = new PGlite();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbgit-test-'));

        // Set store to use temp directory
        store.setRepoRoot(tempDir);

        // Mock connector to use PGlite
        vi.spyOn(connector, 'createPool').mockReturnValue({
            query: (text: string, params?: any[]) => pg.query(text, params),
            end: async () => {},
            connect: async () => {
                const client = {
                    query: (text: string, params?: any[]) => pg.query(text, params),
                    release: () => {}
                };
                return client as any;
            }
        } as any);

        vi.spyOn(connector, 'query').mockImplementation(async (pool, text, params) => {
            const res = await pg.query(text, params);
            return res.rows;
        });

        // Mock prompts
        vi.mock('prompts', () => ({
            default: vi.fn()
        }));

        // Mock process.exit to prevent test runner from exiting
        vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
            if (code && code !== 0) throw new Error(`Process exited with code ${code}`);
            return undefined as never;
        });
    });

    afterEach(async () => {
        await pg.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it('should handle a full flow: init -> commit -> change -> diff -> commit -> rollback', async () => {
        // 1. Init
        await initCommand({ mode: 'dev', recover: false });
        expect(fs.existsSync(path.join(tempDir, '.dbgit'))).toBe(true);

        // 2. Initial state: create a table
        await pg.exec('CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)');
        await commitCommand({ message: 'initial commit' });

        const head1 = store.getHead();
        expect(head1.commit).not.toBeNull();

        // 3. Make a change
        await pg.exec('ALTER TABLE users ADD COLUMN email TEXT');

        // 4. Verify diff
        const pool = connector.createPool({} as any);
        const liveSnapshot = await captureSnapshot(pool, []);
        const lastCommit = store.loadCommit(head1.commit!);
        const oldSnapshot = store.loadSnapshot(lastCommit.snapshotHash);
        const changeset = diffSnapshots(oldSnapshot, liveSnapshot);

        expect(changeset.changes).toHaveLength(1);
        expect(changeset.changes[0].type).toBe('ADD_COLUMN');
        expect(changeset.changes[0].table).toBe('users');
        expect(changeset.changes[0].objectName).toBe('email');

        // 5. Commit change
        await commitCommand({ message: 'add email' });
        const head2 = store.getHead();
        expect(head2.commit).not.toBe(head1.commit);

        // 6. Rollback to initial commit
        vi.mocked(prompts).mockResolvedValue({ confirm: 'DESTROY DATA' });
        await rollbackCommand(head1.commit!, { safe: false, force: true, dryRun: false, softDelete: false });

        // 7. Verify schema restored
        const finalSnapshot = await captureSnapshot(pool, []);
        expect(finalSnapshot.tables['users'].columns.find(c => c.name === 'email')).toBeUndefined();
        expect(finalSnapshot.tables['users'].columns.find(c => c.name === 'name')).toBeDefined();
    });
});
