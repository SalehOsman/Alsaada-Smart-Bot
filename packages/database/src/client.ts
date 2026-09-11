import { PrismaClient } from './generated/client/index.js';
import { createSoftDeleteExtension } from './extensions/soft-delete.extension.js';
import { hashLedgerExtension } from './ledger/hash-ledger.extension.js';

const globalForPrisma = globalThis as unknown as {
  prismaInstance?: ReturnType<typeof createExtendedPrismaClient> | undefined;
};

export function createExtendedPrismaClient(): PrismaClient {
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  return baseClient
    .$extends(createSoftDeleteExtension())
    .$extends(hashLedgerExtension) as unknown as PrismaClient;
}

export const prisma: PrismaClient = globalForPrisma.prismaInstance ?? createExtendedPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaInstance = prisma;
}

export type ExtendedPrismaClient = PrismaClient;

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  console.log('✅ [DATABASE] Connected successfully to PostgreSQL (alsaada_enterprise_postgres)');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('🛑 [DATABASE] Disconnected from PostgreSQL');
}

export async function pingDatabase(): Promise<number> {
  const start = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return Date.now() - start;
}
