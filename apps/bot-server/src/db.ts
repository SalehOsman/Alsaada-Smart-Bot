import { PrismaClient } from '@alsaada/database';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  console.log('✅ [DATABASE] Connected successfully to PostgreSQL (alsaada_enterprise_postgres)');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('🛑 [DATABASE] Disconnected from PostgreSQL');
}
