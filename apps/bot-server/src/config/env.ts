import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config();

export interface AppConfig {
  nodeEnv: string;
  port: number;
  botToken: string;
  superAdminTelegramId: bigint;
  databaseUrl: string;
  redisUrl: string;
  databaseEncryptionKey: string;
  blindIndexSalt: string;
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.PORT || '3000', 10);
  const botToken = process.env.BOT_TOKEN || '';
  const superAdminTelegramIdRaw = process.env.SUPER_ADMIN_TELEGRAM_ID || '0';
  const databaseUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const databaseEncryptionKey = process.env.DATABASE_ENCRYPTION_KEY || '';
  const blindIndexSalt = process.env.BLIND_INDEX_SALT || '';

  if (!botToken || botToken === 'YOUR_NEW_BOT_TOKEN_HERE') {
    console.warn('⚠️ [CONFIG WARNING] BOT_TOKEN is not configured or using placeholder in .env');
  }

  return {
    nodeEnv,
    port,
    botToken,
    superAdminTelegramId: BigInt(superAdminTelegramIdRaw === 'YOUR_TELEGRAM_ID_HERE' ? '0' : superAdminTelegramIdRaw),
    databaseUrl,
    redisUrl,
    databaseEncryptionKey,
    blindIndexSalt,
  };
}

export const config = loadConfig();
