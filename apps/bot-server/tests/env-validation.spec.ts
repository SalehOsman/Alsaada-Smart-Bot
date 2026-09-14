import { describe, it, expect, beforeEach } from 'vitest';
import { validateStartupEnv, validateDashboardAuthEnv, AppConfig } from '../src/config/env.js';
import { DashboardAuthConfigError } from '@alsaada/rbac';

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
    gitCommitSha: '20bcd180a05ef25ec9990ad44b9a19f7ce7abff2',
    buildTime: '2026-09-13T12:00:00.000Z',
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

describe('Dashboard Auth Environment Validation (validateDashboardAuthEnv)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('validates default localtest.me and tunnel URLs correctly', () => {
    delete process.env.DASHBOARD_LOCAL_URL;
    delete process.env.DASHBOARD_TUNNEL_URL;
    delete process.env.DASHBOARD_URL;
    delete process.env.ADMIN_DASHBOARD_URL;

    const origins = validateDashboardAuthEnv();
    expect(origins.localOrigin).toBe('http://localtest.me:3002');
    expect(origins.tunnelOrigin).toBe('https://panel.alsaada.org');
  });

  it('accepts custom valid localtest.me port and HTTPS tunnel URL', () => {
    process.env.DASHBOARD_LOCAL_URL = 'http://localtest.me:4000';
    process.env.DASHBOARD_TUNNEL_URL = 'https://custom-tunnel.ngrok-free.app';

    const origins = validateDashboardAuthEnv();
    expect(origins.localOrigin).toBe('http://localtest.me:4000');
    expect(origins.tunnelOrigin).toBe('https://custom-tunnel.ngrok-free.app');
  });

  it('throws DashboardAuthConfigError when DASHBOARD_LOCAL_URL is invalid (e.g. nip.io or localhost)', () => {
    process.env.DASHBOARD_LOCAL_URL = 'http://127.0.0.1.nip.io:3002';
    expect(() => validateDashboardAuthEnv()).toThrow(DashboardAuthConfigError);

    process.env.DASHBOARD_LOCAL_URL = 'http://localhost:3002';
    expect(() => validateDashboardAuthEnv()).toThrow(DashboardAuthConfigError);
  });

  it('throws DashboardAuthConfigError when DASHBOARD_TUNNEL_URL is not HTTPS', () => {
    process.env.DASHBOARD_LOCAL_URL = 'http://localtest.me:3002';
    process.env.DASHBOARD_TUNNEL_URL = 'http://insecure-tunnel.example.com';
    expect(() => validateDashboardAuthEnv()).toThrow(DashboardAuthConfigError);
  });
});
