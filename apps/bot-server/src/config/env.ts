import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { TelemetryLogger } from '@alsaada/telemetry';

const logger = new TelemetryLogger({
  service: 'bot-server',
  defaultComponent: 'config',
});

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
  dashboardUrl: string;
  dashboardLocalUrl: string;
  dashboardTunnelUrl: string;
  dashboardAuthLinkSecret: string;
  dashboardAuthLinkTtlMinutes: number;
  dashboardSessionTtlHours: number;
  dashboardSessionNoticeMinutes: number;
  dashboardSessionExtensionHours: number;
  gitCommitSha?: string;
  buildTime?: string;
}

export function loadConfig(): AppConfig {
  const appVersion = process.env.APP_VERSION || '2.0.0-alpha.1';
  const gitCommitSha = process.env.GIT_COMMIT_SHA || 'unknown';
  const buildTime = process.env.BUILD_TIME || 'unknown';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.PORT || '3000', 10);
  const botToken = process.env.BOT_TOKEN || '';
  const botUsername = (process.env.BOT_USERNAME || 'Al_Saada_smart_bot').replace(/^@/, '').trim();
  const superAdminTelegramIdRaw = process.env.SUPER_ADMIN_TELEGRAM_ID || '0';
  const databaseUrl = process.env.DATABASE_URL || '';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const databaseEncryptionKey = process.env.DATABASE_ENCRYPTION_KEY || '';
  const blindIndexSalt = process.env.BLIND_INDEX_SALT || '';
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const googleDriveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  const googleServiceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const googlePrivateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const dashboardLocalUrlRaw = (process.env.DASHBOARD_LOCAL_URL || 'http://127.0.0.1.nip.io:3002').replace(/\/+$/, '');
  const dashboardLocalUrl = dashboardLocalUrlRaw.startsWith('http://localhost')
    ? 'http://127.0.0.1.nip.io:3002'
    : dashboardLocalUrlRaw;
  const dashboardUrl = (process.env.DASHBOARD_URL || process.env.ADMIN_DASHBOARD_URL || dashboardLocalUrl).replace(/\/+$/, '');
  const rawTunnelUrl =
    process.env.DASHBOARD_TUNNEL_URL ||
    (process.env.DASHBOARD_URL && !process.env.DASHBOARD_URL.includes('localhost') && !process.env.DASHBOARD_URL.includes('127.0.0.1') ? process.env.DASHBOARD_URL : '') ||
    (process.env.ADMIN_DASHBOARD_URL && !process.env.ADMIN_DASHBOARD_URL.includes('localhost') && !process.env.ADMIN_DASHBOARD_URL.includes('127.0.0.1') ? process.env.ADMIN_DASHBOARD_URL : '') ||
    dashboardLocalUrl;
  const dashboardTunnelUrl = rawTunnelUrl.replace(/\/+$/, '');
  const dashboardAuthLinkSecret = process.env.DASHBOARD_AUTH_LINK_SECRET || process.env.DATABASE_ENCRYPTION_KEY || 'sovereign-dashboard-secret-32-chars';
  const dashboardAuthLinkTtlMinutes = parseInt(process.env.DASHBOARD_AUTH_LINK_TTL_MINUTES || '5', 10);
  const dashboardSessionTtlHours = parseInt(process.env.DASHBOARD_SESSION_TTL_HOURS || '8', 10);
  const dashboardSessionNoticeMinutes = parseInt(process.env.DASHBOARD_SESSION_NOTICE_MINUTES || '60', 10);
  const dashboardSessionExtensionHours = parseInt(process.env.DASHBOARD_SESSION_EXTENSION_HOURS || '8', 10);

  if (!botToken || botToken === 'YOUR_NEW_BOT_TOKEN_HERE') {
    logger.warn('BOT_TOKEN is not configured or uses a placeholder', {
      action: 'config.load',
    });
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
    dashboardUrl,
    dashboardLocalUrl,
    dashboardTunnelUrl,
    dashboardAuthLinkSecret,
    dashboardAuthLinkTtlMinutes,
    dashboardSessionTtlHours,
    dashboardSessionNoticeMinutes,
    dashboardSessionExtensionHours,
    gitCommitSha,
    buildTime,
  };
}

export const config = loadConfig();
const globalWithConfig = globalThis as typeof globalThis & { config?: AppConfig };
globalWithConfig.config = config;

export function validateStartupEnv(cfg: AppConfig = config): void {
  const errors: string[] = [];

  // 1. Validate BOT_TOKEN
  const botToken = cfg.botToken ? cfg.botToken.trim() : '';
  if (
    !botToken ||
    botToken === 'YOUR_NEW_BOT_TOKEN_HERE' ||
    botToken === 'your_telegram_bot_token_here'
  ) {
    errors.push('BOT_TOKEN is missing or set to placeholder in environment (.env).');
  }

  // 2. Validate DATABASE_ENCRYPTION_KEY
  const encKey = cfg.databaseEncryptionKey ? cfg.databaseEncryptionKey.trim() : '';
  if (!encKey) {
    errors.push('DATABASE_ENCRYPTION_KEY is missing or empty in environment (.env).');
  } else if (!/^[0-9a-fA-F]{64}$/.test(encKey)) {
    errors.push(
      `DATABASE_ENCRYPTION_KEY is invalid: expected 64 hexadecimal characters (32 bytes AES-256), got ${encKey.length} characters.`
    );
  } else if (
    encKey.toLowerCase() === '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' &&
    cfg.nodeEnv === 'production'
  ) {
    errors.push('DATABASE_ENCRYPTION_KEY is using insecure example key from .env.example in production.');
  }

  // 3. Validate DASHBOARD_URL in production (must use HTTPS unless localhost)
  if (cfg.nodeEnv === 'production' && cfg.dashboardUrl) {
    const isLocal = cfg.dashboardUrl.includes('localhost') || cfg.dashboardUrl.includes('127.0.0.1');
    if (!isLocal && !cfg.dashboardUrl.startsWith('https://')) {
      errors.push('DASHBOARD_URL must use HTTPS in production.');
    }
  }

  if (errors.length > 0) {
    const banner = [
      '================================================================',
      '❌ [FATAL CONFIG ERROR] Al-Saada Bot Server Startup Aborted:',
      ...errors.map((e) => `   • ${e}`),
      '================================================================',
    ].join('\n');
    throw new Error(banner);
  }
}
