import { PrismaPg } from '@prisma/adapter-pg';
import pg, { Pool } from 'pg';
import { PrismaClient } from './generated/client/index.js';
import { createSoftDeleteExtension } from './extensions/soft-delete.extension.js';
import { hashLedgerExtension } from './ledger/hash-ledger.extension.js';

try {
  process.loadEnvFile('.env');
} catch {}

const globalForPrisma = globalThis as unknown as {
  prismaInstance?: ReturnType<typeof createExtendedPrismaClient> | undefined;
  pgPoolInstance?: Pool | undefined;
};

export function getPgPool(): Pool {
  if (!globalForPrisma.pgPoolInstance) {
    const poolMax = process.env.DB_POOL_MAX
      ? parseInt(process.env.DB_POOL_MAX, 10)
      : (process.env.NODE_ENV === 'test' ? 3 : 15);

    globalForPrisma.pgPoolInstance = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://alsaada_admin:alsaada_secure_pass_2026@127.0.0.1:5432/alsaada_db?schema=public',
      max: poolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return globalForPrisma.pgPoolInstance;
}

export function createExtendedPrismaClient(options?: any): PrismaClient {
  const customUrl = options?.connectionString ?? options?.datasources?.db?.url;
  const pool = options?.pool ?? (customUrl ? new Pool({
    connectionString: customUrl,
    max: process.env.NODE_ENV === 'test' ? 3 : 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  }) : getPgPool());
  const adapter = options?.adapter ?? new PrismaPg(pool);

  const { datasources, pool: _p, adapter: _a, connectionString: _cs, ...prismaOptions } = options ?? {};

  const baseClient = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    ...prismaOptions,
  });

  const client = baseClient
    .$extends(createSoftDeleteExtension())
    .$extends(hashLedgerExtension) as unknown as PrismaClient;

  if (customUrl) {
    const originalDisconnect = client.$disconnect.bind(client);
    client.$disconnect = async () => {
      await originalDisconnect();
      await pool.end().catch(() => {});
    };
  }

  return client;
}

export const prisma: PrismaClient = globalForPrisma.prismaInstance ?? createExtendedPrismaClient();

globalForPrisma.prismaInstance = prisma;

export type ExtendedPrismaClient = PrismaClient;
export type DatabaseClient = ExtendedPrismaClient;
export { pg, PrismaPg };

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  console.log('✅ [DATABASE] Connected successfully to PostgreSQL (alsaada_enterprise_postgres)');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  if (globalForPrisma.pgPoolInstance) {
    await globalForPrisma.pgPoolInstance.end();
    globalForPrisma.pgPoolInstance = undefined;
  }
  globalForPrisma.prismaInstance = undefined;
  console.log('🛑 [DATABASE] Disconnected from PostgreSQL');
}

export async function pingDatabase(): Promise<number> {
  const start = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return Date.now() - start;
}
