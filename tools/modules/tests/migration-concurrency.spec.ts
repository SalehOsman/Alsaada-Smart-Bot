import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  deployDatabaseMigrations,
  DEPLOYMENT_ADVISORY_LOCK_ID,
  MigrationDeploymentLockError,
  type PgClientLike,
} from '../deploy-migrations.js';

describe('Work Plan 89 — Migration Concurrency & Deployment Lock Guard (Phase P5)', () => {
  it('acquires advisory lock, executes pending migrations, and records in applied table', async () => {
    const executedQueries: string[] = [];
    const mockPgClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
        executedQueries.push(typeof sql === 'string' ? sql.trim() : '');
        // 1. Lock query
        if (typeof sql === 'string' && sql.includes('pg_try_advisory_lock')) {
          return { rows: [{ acquired: true }] };
        }
        // 2. Applied check
        if (typeof sql === 'string' && sql.includes('SELECT COUNT(*)')) {
          return { rows: [{ count: '0' }] };
        }
        return { rows: [] };
      }),
    } as unknown as PgClientLike;

    const tmpMigDir = path.resolve(process.cwd(), 'tmp-test-deploy-mig');
    fs.mkdirSync(path.join(tmpMigDir, '20260921000000_init'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpMigDir, '20260921000000_init', 'migration.sql'),
      'CREATE TABLE test_tbl (id text);',
      'utf8'
    );

    try {
      const result = await deployDatabaseMigrations({
        migrationsDir: tmpMigDir,
        pgClient: mockPgClient,
      });

      expect(result.ok).toBe(true);
      expect(result.appliedCount).toBe(1);
      expect(result.appliedMigrations).toContain('20260921000000_init');

      // Verify lock acquired and released
      expect(mockPgClient.query).toHaveBeenCalledWith(
        'SELECT pg_try_advisory_lock($1) as acquired;',
        [DEPLOYMENT_ADVISORY_LOCK_ID]
      );
      expect(mockPgClient.query).toHaveBeenCalledWith(
        'SELECT pg_advisory_unlock($1);',
        [DEPLOYMENT_ADVISORY_LOCK_ID]
      );
    } finally {
      fs.rmSync(tmpMigDir, { recursive: true, force: true });
    }
  });

  it('fails safely when another concurrent deployer holds the advisory lock', async () => {
    const mockPgClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('pg_try_advisory_lock')) {
          // Another deployer holds lock!
          return { rows: [{ acquired: false }] };
        }
        return { rows: [] };
      }),
    } as unknown as PgClientLike;

    const tmpMigDir = path.resolve(process.cwd(), 'tmp-test-deploy-locked');
    fs.mkdirSync(tmpMigDir, { recursive: true });

    try {
      const result = await deployDatabaseMigrations({
        migrationsDir: tmpMigDir,
        pgClient: mockPgClient,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Failed to acquire migration deployment lock');
      expect(result.appliedCount).toBe(0);
    } finally {
      fs.rmSync(tmpMigDir, { recursive: true, force: true });
    }
  });
});
