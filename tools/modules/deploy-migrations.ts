/**
 * Enterprise Database Migration Deployer (Work Plan 89 - Phase P5)
 * 
 * Executes compiled module migrations under a PostgreSQL advisory deployment lock
 * (890001) ensuring mutual exclusion, zero concurrency collisions, and deterministic logs.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const DEPLOYMENT_ADVISORY_LOCK_ID = 890001;

export interface QueryResultLike<T = Record<string, unknown>> {
  rows: T[];
}

export interface PgClientLike {
  connect?: (() => Promise<void>) | undefined;
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<QueryResultLike<T>>;
  end?: (() => Promise<void>) | undefined;
}

export interface MigrationDeployOptions {
  connectionString?: string | undefined;
  migrationsDir?: string | undefined;
  dryRun?: boolean | undefined;
  pgClient?: PgClientLike | undefined;
}

export interface MigrationDeployResult {
  ok: boolean;
  appliedCount: number;
  appliedMigrations: string[];
  durationMs: number;
  error?: string | undefined;
}

export class MigrationDeploymentLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationDeploymentLockError';
  }
}

/**
 * Executes migrations safely under PostgreSQL advisory lock.
 */
export async function deployDatabaseMigrations(
  options: MigrationDeployOptions = {}
): Promise<MigrationDeployResult> {
  const startTime = Date.now();
  const root = process.cwd();
  const migrationsDir = options.migrationsDir
    ? resolve(options.migrationsDir)
    : join(root, '.generated', 'database', 'migrations');

  if (!existsSync(migrationsDir)) {
    return {
      ok: true,
      appliedCount: 0,
      appliedMigrations: [],
      durationMs: Date.now() - startTime,
    };
  }

  let client = options.pgClient;
  let isInternalClient = false;

  if (!client) {
    try {
      // @ts-expect-error - pg is installed in @alsaada/database, loaded dynamically at runtime
      const pgModule = (await import('pg')) as {
        default?: { Client: new (cfg: { connectionString: string }) => PgClientLike };
        Client?: new (cfg: { connectionString: string }) => PgClientLike;
      };
      const ClientConstructor = pgModule.default?.Client ?? pgModule.Client;
      if (!ClientConstructor) {
        throw new Error("Cannot resolve Client constructor from 'pg'");
      }
      client = new ClientConstructor({
        connectionString:
          options.connectionString ??
          process.env.DATABASE_TEST_URL ??
          process.env.DATABASE_URL ??
          'postgresql://postgres:postgres@127.0.0.1:5432/alsaada_test_db',
      });
      isInternalClient = true;
    } catch {
      return {
        ok: false,
        appliedCount: 0,
        appliedMigrations: [],
        durationMs: Date.now() - startTime,
        error: "PostgreSQL client 'pg' could not be loaded. Pass a pgClient to deployDatabaseMigrations.",
      };
    }
  }

  if (!client) {
    return {
      ok: false,
      appliedCount: 0,
      appliedMigrations: [],
      durationMs: Date.now() - startTime,
      error: 'No active PostgreSQL client available.',
    };
  }

  const activeClient = client;
  let lockAcquired = false;
  const appliedMigrations: string[] = [];

  try {
    if (isInternalClient && activeClient.connect) {
      await activeClient.connect();
    }

    // 1. Acquire Deployment Advisory Lock
    const lockRes = await activeClient.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock($1) as acquired;`,
      [DEPLOYMENT_ADVISORY_LOCK_ID]
    );

    const acquired = lockRes.rows[0]?.acquired ?? false;
    if (!acquired) {
      throw new MigrationDeploymentLockError(
        `Failed to acquire migration deployment lock (${DEPLOYMENT_ADVISORY_LOCK_ID}). Another deployer is actively running.`
      );
    }
    lockAcquired = true;

    // 2. Ensure migration log table exists
    await activeClient.query(`
      CREATE TABLE IF NOT EXISTS "_module_migrations_applied" (
        "id" VARCHAR(255) PRIMARY KEY,
        "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "duration_ms" INTEGER NOT NULL
      );
    `);

    // 3. Scan migrations in strict alphabetical / timestamp order
    const migEntries = readdirSync(migrationsDir, { withFileTypes: true });
    migEntries.sort((a, b) => a.name.localeCompare(b.name));

    for (const ent of migEntries) {
      if (!ent.isDirectory()) continue;
      const migName = ent.name;
      const sqlFile = join(migrationsDir, migName, 'migration.sql');
      if (!existsSync(sqlFile)) continue;

      // Check if already applied
      const checkRes = await activeClient.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM "_module_migrations_applied" WHERE "id" = $1;`,
        [migName]
      );
      if (parseInt(checkRes.rows[0]?.count ?? '0', 10) > 0) {
        // Already applied
        continue;
      }

      const sqlContent = readFileSync(sqlFile, 'utf8');

      if (!options.dryRun) {
        const stepStart = Date.now();
        await activeClient.query('BEGIN;');
        try {
          if (sqlContent.trim().length > 0) {
            await activeClient.query(sqlContent);
          }
          const stepDuration = Date.now() - stepStart;
          await activeClient.query(
            `INSERT INTO "_module_migrations_applied" ("id", "duration_ms") VALUES ($1, $2);`,
            [migName, stepDuration]
          );
          await activeClient.query('COMMIT;');
          appliedMigrations.push(migName);
        } catch (stepErr: unknown) {
          await activeClient.query('ROLLBACK;');
          throw stepErr;
        }
      } else {
        appliedMigrations.push(migName);
      }
    }

    return {
      ok: true,
      appliedCount: appliedMigrations.length,
      appliedMigrations,
      durationMs: Date.now() - startTime,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      appliedCount: appliedMigrations.length,
      appliedMigrations,
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (lockAcquired) {
      try {
        await activeClient.query(`SELECT pg_advisory_unlock($1);`, [DEPLOYMENT_ADVISORY_LOCK_ID]);
      } catch {
        // ignore unlock cleanup error
      }
    }
    if (isInternalClient && activeClient?.end) {
      await activeClient.end().catch(() => {});
    }
  }
}

// CLI execution check
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('🚀 Deploying monorepo database migrations under deployment lock...');
  deployDatabaseMigrations()
    .then((res) => {
      if (!res.ok) {
        console.error('❌ Migration deployment failed:', res.error);
        process.exit(1);
      }
      console.log(`✅ Applied ${res.appliedCount} migration(s) in ${res.durationMs}ms`);
      for (const m of res.appliedMigrations) {
        console.log(`   - ${m}`);
      }
    })
    .catch((err) => {
      console.error('❌ Fatal deployment error:', err);
      process.exit(1);
    });
}
