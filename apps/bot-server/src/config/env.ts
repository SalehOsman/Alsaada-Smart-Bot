import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { TelemetryLogger } from '@alsaada/telemetry';

import {
  DashboardAuthConfigError,
  validateDashboardAuthOrigins,
  type DashboardAuthOrigins,
} from '@alsaada/rbac';


const logger = new TelemetryLogger({
  service: 'bot-server',
  defaultComponent: 'config',
});

/**
 * Pure helper to resolve tunnel URL avoiding loopbacks and DRY code duplication
 */
export function resolveTunnelUrl(rawDashboardUrl: string, configuredTunnel?: string): string {
  if (configuredTunnel && configuredTunnel.trim()) {
    return configuredTunnel.trim().replace(/\/+$/, '');
  }
  const isLoopback =
    rawDashboardUrl.includes('localhost') ||
    rawDashboardUrl.includes('127.0.0.1') ||
    rawDashboardUrl.includes('localtest.me');
  if (rawDashboardUrl && !isLoopback) {
    return rawDashboardUrl.trim().replace(/\/+$/, '');
  }
  return 'https://panel.alsaada.org';
}

function parseSafeBigInt(val: string | undefined, fallback = 0n): bigint {
  if (!val || val === 'YOUR_TELEGRAM_ID_HERE') return fallback;
  const sanitized = val.trim();
  if (!/^\d+$/.test(sanitized)) return fallback;
  try {
    return BigInt(sanitized);
  } catch (err) {
    logger.warn('Failed to parse superAdminTelegramId to BigInt, using fallback', {
      action: 'config.parse-bigint',
      error: err,
    });
    return fallback;
  }
}



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
  telegramApiRoot: string;
  telegramLocal: boolean;
  webhookUrl: string;
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
  const dashboardLocalUrl = (process.env.DASHBOARD_LOCAL_URL || 'http://localtest.me:3002').replace(/\/+$/, '');
  const rawDashboardUrl = process.env.DASHBOARD_URL || process.env.ADMIN_DASHBOARD_URL || '';
  const dashboardTunnelUrl = resolveTunnelUrl(rawDashboardUrl, process.env.DASHBOARD_TUNNEL_URL);
  const dashboardUrl = (process.env.DASHBOARD_URL || dashboardTunnelUrl || dashboardLocalUrl).replace(/\/+$/, '');
  const dashboardAuthLinkSecret = process.env.DASHBOARD_AUTH_LINK_SECRET || '';
  const dashboardAuthLinkTtlMinutes = parseInt(process.env.DASHBOARD_AUTH_LINK_TTL_MINUTES || '5', 10);
  const dashboardSessionTtlHours = parseInt(process.env.DASHBOARD_SESSION_TTL_HOURS || '8', 10);
  const dashboardSessionNoticeMinutes = parseInt(process.env.DASHBOARD_SESSION_NOTICE_MINUTES || '60', 10);
  const dashboardSessionExtensionHours = parseInt(process.env.DASHBOARD_SESSION_EXTENSION_HOURS || '8', 10);
  const telegramApiRoot = process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org';
  const telegramLocal = process.env.TELEGRAM_LOCAL === 'true';
  const webhookUrl = process.env.WEBHOOK_URL || '';

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
    superAdminTelegramId: parseSafeBigInt(superAdminTelegramIdRaw),
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
    telegramApiRoot,
    telegramLocal,
    webhookUrl,
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

  // 2. Validate DATABASE_URL
  const dbUrl = cfg.databaseUrl ? cfg.databaseUrl.trim() : '';
  if (!dbUrl || dbUrl === 'YOUR_DATABASE_URL_HERE') {
    errors.push('DATABASE_URL is missing or unconfigured in environment (.env).');
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

  // 3. Validate DASHBOARD_URL in production (must use HTTPS unless local origin)
  if (cfg.nodeEnv === 'production' && cfg.dashboardUrl) {
    const isLocalHost =
      cfg.dashboardUrl.includes('localtest.me') ||
      cfg.dashboardUrl.includes('localhost') ||
      cfg.dashboardUrl.includes('127.0.0.1');
    if (!isLocalHost) {
      try {
        const parsedDashboardUrl = new URL(cfg.dashboardUrl);
        if (parsedDashboardUrl.protocol !== 'https:') {
          errors.push('DASHBOARD_URL must use HTTPS in production.');
        }
      } catch (urlErr) {
        logger.warn('Failed to parse DASHBOARD_URL during startup validation', {
          action: 'config.validate.dashboard-url',
          error: urlErr,
        });
        errors.push('DASHBOARD_URL must be a valid URL.');
      }
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

/**
 * Validates dashboard authentication environment variables against @alsaada/rbac SSOT contract.
 * Uses validateDashboardAuthOrigins pure function.
 */
export function validateDashboardAuthEnv(): DashboardAuthOrigins {
  const localUrl = process.env.DASHBOARD_LOCAL_URL || 'http://localtest.me:3002';
  const rawDashboardUrl = process.env.DASHBOARD_URL || process.env.ADMIN_DASHBOARD_URL || '';
  const tunnelUrl = resolveTunnelUrl(rawDashboardUrl, process.env.DASHBOARD_TUNNEL_URL);
  const res = validateDashboardAuthOrigins({ localUrl, tunnelUrl });
  if (!res.ok) {
    throw new DashboardAuthConfigError(`DASHBOARD_AUTH_CONFIG_ERROR: ${res.code}`);
  }
  return res.origins;
}

