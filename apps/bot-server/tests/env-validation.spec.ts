import { describe, it, expect } from 'vitest';
import { validateStartupEnv, AppConfig } from '../src/config/env.js';

describe('Startup Environment Fail-Fast Validation (validateStartupEnv)', () => {
  const baseValidConfig: AppConfig = {
    appVersion: '2.0.0',
    nodeEnv: 'development',
    port: 3000,
    botToken: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz12345678',
    botUsername: 'Alsaada_Bot',
    superAdminTelegramId: 123456789n,
    databaseUrl: 'postgresql://user:pass@localhost:5432/db',
    redisUrl: 'redis://localhost:6379',
    databaseEncryptionKey: 'a'.repeat(64),
    blindIndexSalt: 'b'.repeat(32),
    geminiApiKey: '',
    googleDriveFolderId: '',
    googleServiceAccountEmail: '',
    googlePrivateKey: '',
    dashboardUrl: 'http://localhost:3002',
    dashboardLocalUrl: 'http://localhost:3002',
    dashboardTunnelUrl: 'https://dashboard.example.com',
    dashboardAuthLinkSecret: 'super-secret-dashboard-auth-key-12345',
    dashboardAuthLinkTtlMinutes: 10,
    dashboardSessionTtlHours: 8,
    dashboardSessionNoticeMinutes: 15,
    dashboardSessionExtensionHours: 8,
  };

  it('passes with valid BOT_TOKEN and 64-char hex DATABASE_ENCRYPTION_KEY', () => {
    expect(() => validateStartupEnv(baseValidConfig)).not.toThrow();
  });

  it('throws fatal error when BOT_TOKEN is missing or empty', () => {
    expect(() => validateStartupEnv({ ...baseValidConfig, botToken: '' })).toThrow(/BOT_TOKEN is missing/i);
    expect(() => validateStartupEnv({ ...baseValidConfig, botToken: '   ' })).toThrow(/BOT_TOKEN is missing/i);
  });

  it('throws fatal error when BOT_TOKEN is set to placeholder values', () => {
    expect(() => validateStartupEnv({ ...baseValidConfig, botToken: 'YOUR_NEW_BOT_TOKEN_HERE' })).toThrow(
      /BOT_TOKEN is missing or set to placeholder/i
    );
    expect(() => validateStartupEnv({ ...baseValidConfig, botToken: 'your_telegram_bot_token_here' })).toThrow(
      /BOT_TOKEN is missing or set to placeholder/i
    );
  });

  it('throws fatal error when DATABASE_ENCRYPTION_KEY is missing or empty', () => {
    expect(() => validateStartupEnv({ ...baseValidConfig, databaseEncryptionKey: '' })).toThrow(
      /DATABASE_ENCRYPTION_KEY is missing or empty/i
    );
    expect(() => validateStartupEnv({ ...baseValidConfig, databaseEncryptionKey: '   ' })).toThrow(
      /DATABASE_ENCRYPTION_KEY is missing or empty/i
    );
  });

  it('throws fatal error when DATABASE_ENCRYPTION_KEY is not 64 hex characters', () => {
    expect(() =>
      validateStartupEnv({ ...baseValidConfig, databaseEncryptionKey: 'alsaada-default-key' })
    ).toThrow(/expected 64 hexadecimal characters/i);

    expect(() =>
      validateStartupEnv({ ...baseValidConfig, databaseEncryptionKey: '123456' })
    ).toThrow(/expected 64 hexadecimal characters/i);

    // Non-hex characters (e.g. 'z')
    expect(() =>
      validateStartupEnv({ ...baseValidConfig, databaseEncryptionKey: 'z'.repeat(64) })
    ).toThrow(/expected 64 hexadecimal characters/i);
  });

  it('throws fatal error when DATABASE_ENCRYPTION_KEY is example key in production', () => {
    const exampleKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    expect(() =>
      validateStartupEnv({
        ...baseValidConfig,
        nodeEnv: 'production',
        databaseEncryptionKey: exampleKey,
      })
    ).toThrow(/insecure example key from \.env\.example in production/i);
  });

  it('permits example key in non-production environments (development / test)', () => {
    const exampleKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    expect(() =>
      validateStartupEnv({
        ...baseValidConfig,
        nodeEnv: 'development',
        databaseEncryptionKey: exampleKey,
      })
    ).not.toThrow();

    expect(() =>
      validateStartupEnv({
        ...baseValidConfig,
        nodeEnv: 'test',
        databaseEncryptionKey: exampleKey,
      })
    ).not.toThrow();
  });

  it('rejects a non-HTTPS dashboard URL in production', () => {
    expect(() =>
      validateStartupEnv({
        ...baseValidConfig,
        nodeEnv: 'production',
        dashboardUrl: 'http://dashboard.internal:3002',
      }),
    ).toThrow(/DASHBOARD_URL.*HTTPS/i);
  });

  it('allows an HTTP localhost dashboard URL outside production', () => {
    expect(() =>
      validateStartupEnv({
        ...baseValidConfig,
        nodeEnv: 'development',
        dashboardUrl: 'http://localhost:3002',
      }),
    ).not.toThrow();
  });

  it('aggregates multiple configuration errors in a single formatted banner', () => {
    expect(() =>
      validateStartupEnv({
        ...baseValidConfig,
        botToken: '',
        databaseEncryptionKey: '',
      })
    ).toThrow(/FATAL CONFIG ERROR[\s\S]*BOT_TOKEN[\s\S]*DATABASE_ENCRYPTION_KEY/i);
  });
});
