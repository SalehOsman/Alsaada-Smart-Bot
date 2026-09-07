import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config();

export interface AppConfig {
  appVersion: string;
  nodeEnv: string;
  port: number;
  botToken: string;
  superAdminTelegramId: bigint;
  databaseUrl: string;
  redisUrl: string;
  databaseEncryptionKey: string;
  blindIndexSalt: string;
  geminiApiKey: string;
  googleDriveFolderId: string;
  googleServiceAccountEmail: string;
  googlePrivateKey: string;
}

export function loadConfig(): AppConfig {
  const appVersion = process.env.APP_VERSION || '2.0.0-alpha.1';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.PORT || '3000', 10);
  const botToken = process.env.BOT_TOKEN || '';
  const superAdminTelegramIdRaw = process.env.SUPER_ADMIN_TELEGRAM_ID || '0';
  const databaseUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const databaseEncryptionKey = process.env.DATABASE_ENCRYPTION_KEY || '';
  const blindIndexSalt = process.env.BLIND_INDEX_SALT || '';
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const googleDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  const googleServiceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const googlePrivateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!botToken || botToken === 'YOUR_NEW_BOT_TOKEN_HERE') {
    console.warn('⚠️ [CONFIG WARNING] BOT_TOKEN is not configured or using placeholder in .env');
  }

  return {
    appVersion,
    nodeEnv,
    port,
    botToken,
    superAdminTelegramId: BigInt(superAdminTelegramIdRaw === 'YOUR_TELEGRAM_ID_HERE' ? '0' : superAdminTelegramIdRaw),
    databaseUrl,
    redisUrl,
    databaseEncryptionKey,
    blindIndexSalt,
    geminiApiKey,
    googleDriveFolderId,
    googleServiceAccountEmail,
    googlePrivateKey,
  };
}

export const config = loadConfig();
