import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initCommand } from '../../src/commands/init.js';
import { commitCommand } from '../../src/commands/commit.js';
import * as store from '../../src/core/store.js';
import fs from 'fs';
import path from 'path';

// To run against a real PostgreSQL instance, set TEST_DATABASE_URL env var.
// Skip block if not set.

vi.mock('../../src/core/store.js', async () => {
    const actual = await vi.importActual('../../src/core/store.js') as any;
    return {
        ...actual,
        initStore: vi.fn(),
        isInitialized: vi.fn(() => true),
        saveConfig: vi.fn(),
        saveBranch: vi.fn(),
        setHead: vi.fn(),
        getHead: vi.fn(() => ({ branch: 'main', commit: null })),
        loadBranch: vi.fn(() => ({ name: 'main', headCommit: null })),
        saveSnapshot: vi.fn(),
        saveCommit: vi.fn(),
        loadSnapshot: vi.fn(),
        loadCommit: vi.fn(),
    };
});

vi.mock('../../src/core/connector.js', () => ({
    getConnectionConfig: vi.fn(() => ({
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        ssl: false
    })),
    createPool: vi.fn(() => ({
        query: vi.fn(),
        end: vi.fn(),
    })),
    query: vi.fn()
}));

vi.mock('../../src/core/snapshot.js', () => ({
    captureSnapshot: vi.fn(() => Promise.resolve({
        tables: {
            users: { name: 'users', columns: [], indexes: [], constraints: [], foreignKeys: [] }
        },
        capturedAt: new Date().toISOString(),
        schemaHash: 'hash1'
    })),
    hashSnapshot: vi.fn(() => 'hash1')
}));

describe('Integration Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('runs init and commit flow', async () => {
        // Mocking isInitialized to return false for init, then true
        vi.mocked(store.isInitialized).mockReturnValueOnce(false).mockReturnValue(true);

        await initCommand({ mode: 'dev', recover: false });
        expect(store.initStore).toHaveBeenCalled();
        expect(store.saveBranch).toHaveBeenCalledWith(expect.objectContaining({ name: 'main' }));

        await commitCommand({ message: 'initial commit' });
        expect(store.saveCommit).toHaveBeenCalled();
        expect(store.saveSnapshot).toHaveBeenCalled();
    });
});
