import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Locate root .env and load with override: true so root values always take precedence
function findRootEnv(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const rootEnvPath = findRootEnv();
if (rootEnvPath) {
  dotenv.config({ path: rootEnvPath, override: true });
} else {
  dotenv.config({ override: true });
}

export interface AppConfig {
  appVersion: string;
  nodeEnv: string;
  port: number;
  botToken: string;
  botUsername: string;
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
  const botUsername = (process.env.BOT_USERNAME || 'Alsaada_HRtest_Bot').replace(/^@/, '').trim();
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
    botUsername,
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
