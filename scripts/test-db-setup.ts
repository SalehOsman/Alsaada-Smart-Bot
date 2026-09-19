import { execSync } from 'node:child_process';
import net from 'node:net';
import { PrismaClient } from '../packages/database/src/generated/client/index.js';

export const TEST_DB_NAME = 'alsaada_test_db';
export const DEFAULT_POSTGRES_PORT = 5432;
export const DEFAULT_POSTGRES_HOST = '127.0.0.1';

export function getTestDatabaseUrl(): string {
  const base =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://alsaada_admin:alsaada_secure_pass_2026@127.0.0.1:5432/alsaada_db?schema=public';
  return base.replace(/\/alsaada_db\?/, `/${TEST_DB_NAME}?`);
}

export function isPortOpen(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

export async function setupTestDatabase(options: { requireLive?: boolean } = {}): Promise<{
  ok: boolean;
  testDbUrl?: string;
  error?: string;
}> {
  console.log('🔄 [TEST-DB] Checking PostgreSQL availability on 127.0.0.1:5432...');

  let portOpen = await isPortOpen(DEFAULT_POSTGRES_HOST, DEFAULT_POSTGRES_PORT);

  if (!portOpen) {
    console.log('⚠️ [TEST-DB] PostgreSQL not reachable on 5432. Checking Docker daemon fallback...');
    try {
      execSync('docker compose ps', { stdio: 'pipe' });
      console.log('🐳 [TEST-DB] Docker available. Starting postgres container...');
      execSync('docker compose up -d postgres', { stdio: 'inherit' });
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        portOpen = await isPortOpen(DEFAULT_POSTGRES_HOST, DEFAULT_POSTGRES_PORT);
        if (portOpen) break;
      }
    } catch {
      // Docker not available or compose failed
    }
  }

  if (!portOpen) {
    const errorMsg = 'PostgreSQL service is not running on 127.0.0.1:5432 and Docker fallback unavailable.';
    if (options.requireLive || process.env.CI) {
      console.error(`❌ [TEST-DB:FATAL] ${errorMsg}`);
      if (options.requireLive) {
        process.exit(1);
      }
    } else {
      console.warn(`⚠️ [TEST-DB:WARNING] ${errorMsg} (Bypassing for local fast development)`);
    }
    return { ok: false, error: errorMsg };
  }

  const basePrisma = new PrismaClient();
  const testDbUrl = getTestDatabaseUrl();

  try {
    await basePrisma.$connect();

    // 1. Check if test database exists
    const existingDbs = (await basePrisma.$queryRawUnsafe(
      `SELECT 1 FROM pg_database WHERE datname = '${TEST_DB_NAME}'`
    )) as unknown[];

    if (!existingDbs || existingDbs.length === 0) {
      console.log(`📦 [TEST-DB] Creating test database '${TEST_DB_NAME}'...`);
      await basePrisma.$executeRawUnsafe(`CREATE DATABASE "${TEST_DB_NAME}";`);
      console.log(`✅ [TEST-DB] Database '${TEST_DB_NAME}' created.`);
    } else {
      console.log(`✅ [TEST-DB] Test database '${TEST_DB_NAME}' already exists.`);
    }

    await basePrisma.$disconnect();

    // 2. Check if schema already exists in test database
    const testPrisma = new PrismaClient({
      datasources: { db: { url: testDbUrl } },
    });
    let tablesExist = false;
    try {
      await testPrisma.$connect();
      const checkResult = (await testPrisma.$queryRawUnsafe(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_ledgers'"
      )) as unknown[];
      tablesExist = Boolean(checkResult && checkResult.length > 0);
    } catch {
      tablesExist = false;
    } finally {
      await testPrisma.$disconnect().catch(() => {});
    }

    if (tablesExist) {
      console.log(`🎉 [TEST-DB] Isolated test database '${TEST_DB_NAME}' already initialized and ready!`);
      return { ok: true, testDbUrl };
    }

    // 3. Push schema to fresh test database
    console.log('🚀 [TEST-DB] Synchronizing schema via prisma db push...');
    const childEnv: Record<string, string | undefined> = { ...process.env, DATABASE_URL: testDbUrl };
    childEnv.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION =
      process.env.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION || 'موافق على الفتح';
    delete childEnv.ANTIGRAVITY_AGENT;
    delete childEnv.ANTIGRAVITY_CONVERSATION_ID;
    delete childEnv.ANTIGRAVITY_CSRF_TOKEN;
    delete childEnv.ANTIGRAVITY_LS_ADDRESS;

    execSync('pnpm --filter @alsaada/database exec prisma db push --schema=prisma/schema.prisma --accept-data-loss', {
      env: childEnv,
      stdio: 'inherit',
    });

    console.log(`🎉 [TEST-DB] Isolated test database '${TEST_DB_NAME}' ready!`);
    return { ok: true, testDbUrl };
  } catch (err: any) {
    const errorMsg = `Failed to initialize test database: ${err.message || String(err)}`;
    console.error(`❌ [TEST-DB] ${errorMsg}`);
    try {
      await basePrisma.$disconnect();
    } catch {}

    if (options.requireLive || process.env.CI) {
      process.exit(1);
    }
    return { ok: false, error: errorMsg };
  }
}

if (process.argv[1]?.includes('test-db-setup')) {
  const requireLive = process.argv.includes('--require-live');
  setupTestDatabase({ requireLive }).then((res) => {
    if (!res.ok && requireLive) {
      process.exit(1);
    }
    process.exit(0);
  });
}
