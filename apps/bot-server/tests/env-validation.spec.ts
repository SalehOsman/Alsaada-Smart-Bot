import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateStartupEnv, validateDashboardAuthEnv, AppConfig } from '../src/config/env.js';
import { DashboardAuthConfigError } from '@alsaada/rbac';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Startup Environment Fail-Fast Validation (validateStartupEnv)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
    telegramApiRoot: 'https://api.telegram.org',
    telegramLocal: false,
    webhookUrl: '',
    gitCommitSha: '20bcd180a05ef25ec9990ad44b9a19f7ce7abff2',
    buildTime: '2026-09-13T12:00:00.000Z',
  };

  it('passes with valid BOT_TOKEN and 64-char hex DATABASE_ENCRYPTION_KEY', () => {
    // Arrange
    const validConfig = { ...baseValidConfig };

    // Act & Assert
    expect(() => validateStartupEnv(validConfig)).not.toThrow();
    expect(validConfig.databaseEncryptionKey).toHaveLength(64);
    expect(validConfig.botToken).toContain(':');
  });

  it('throws fatal error when BOT_TOKEN is missing or empty', () => {
    // Arrange
    const emptyConfig = { ...baseValidConfig, botToken: '' };
    const whitespaceConfig = { ...baseValidConfig, botToken: '   ' };

    // Act & Assert
    expect(() => validateStartupEnv(emptyConfig)).toThrow(/BOT_TOKEN is missing/i);
    expect(() => validateStartupEnv(whitespaceConfig)).toThrow(/BOT_TOKEN is missing/i);
    expect(emptyConfig.botToken).toBe('');
  });

  it('throws fatal error when BOT_TOKEN is set to placeholder values', () => {
    // Arrange
    const placeholder1 = { ...baseValidConfig, botToken: 'YOUR_NEW_BOT_TOKEN_HERE' };
    const placeholder2 = { ...baseValidConfig, botToken: 'your_telegram_bot_token_here' };

    // Act & Assert
    expect(() => validateStartupEnv(placeholder1)).toThrow(
      /BOT_TOKEN is missing or set to placeholder/i
    );
    expect(() => validateStartupEnv(placeholder2)).toThrow(
      /BOT_TOKEN is missing or set to placeholder/i
    );
    expect(placeholder1.botToken).not.toMatch(/^\d+:[A-Za-z0-9_-]+$/);
  });

  it('throws fatal error when DATABASE_ENCRYPTION_KEY is missing or empty', () => {
    // Arrange
    const missingKeyConfig = { ...baseValidConfig, databaseEncryptionKey: '' };
    const whitespaceKeyConfig = { ...baseValidConfig, databaseEncryptionKey: '   ' };

    // Act & Assert
    expect(() => validateStartupEnv(missingKeyConfig)).toThrow(
      /DATABASE_ENCRYPTION_KEY is missing or empty/i
    );
    expect(() => validateStartupEnv(whitespaceKeyConfig)).toThrow(
      /DATABASE_ENCRYPTION_KEY is missing or empty/i
    );
    expect(missingKeyConfig.databaseEncryptionKey).toHaveLength(0);
  });

  it('throws fatal error when DATABASE_ENCRYPTION_KEY is not 64 hex characters', () => {
    // Arrange
    const nonHexConfig = { ...baseValidConfig, databaseEncryptionKey: 'alsaada-default-key' };
    const shortConfig = { ...baseValidConfig, databaseEncryptionKey: '123456' };
    const invalidCharsConfig = { ...baseValidConfig, databaseEncryptionKey: 'z'.repeat(64) };

    // Act & Assert
    expect(() => validateStartupEnv(nonHexConfig)).toThrow(/expected 64 hexadecimal characters/i);
    expect(() => validateStartupEnv(shortConfig)).toThrow(/expected 64 hexadecimal characters/i);
    expect(() => validateStartupEnv(invalidCharsConfig)).toThrow(/expected 64 hexadecimal characters/i);
  });

  it('throws fatal error when DATABASE_ENCRYPTION_KEY is example key in production', () => {
    // Arrange
    const exampleKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const prodConfig = {
      ...baseValidConfig,
      nodeEnv: 'production' as const,
      databaseEncryptionKey: exampleKey,
    };

    // Act & Assert
    expect(() => validateStartupEnv(prodConfig)).toThrow(/insecure example key from \.env\.example in production/i);
    expect(prodConfig.nodeEnv).toBe('production');
  });

  it('permits example key in non-production environments (development / test)', () => {
    // Arrange
    const exampleKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const devConfig = {
      ...baseValidConfig,
      nodeEnv: 'development' as const,
      databaseEncryptionKey: exampleKey,
    };
    const testConfig = {
      ...baseValidConfig,
      nodeEnv: 'test' as const,
      databaseEncryptionKey: exampleKey,
    };

    // Act & Assert
    expect(() => validateStartupEnv(devConfig)).not.toThrow();
    expect(() => validateStartupEnv(testConfig)).not.toThrow();
    expect(devConfig.nodeEnv).not.toBe('production');
  });

  it('rejects a non-HTTPS dashboard URL in production', () => {
    // Arrange
    const insecureProdConfig = {
      ...baseValidConfig,
      nodeEnv: 'production' as const,
      dashboardUrl: 'http://dashboard.internal:3002',
    };

    // Act & Assert
    expect(() => validateStartupEnv(insecureProdConfig)).toThrow(/DASHBOARD_URL.*HTTPS/i);
    expect(insecureProdConfig.dashboardUrl).toMatch(/^http:/);
  });

  it('allows an HTTP localhost dashboard URL outside production', () => {
    // Arrange
    const devDashboardConfig = {
      ...baseValidConfig,
      nodeEnv: 'development' as const,
      dashboardUrl: 'http://localhost:3002',
    };

    // Act & Assert
    expect(() => validateStartupEnv(devDashboardConfig)).not.toThrow();
    expect(devDashboardConfig.nodeEnv).not.toBe('production');
    expect(devDashboardConfig.dashboardUrl).toContain('localhost');
  });

  it('aggregates multiple configuration errors in a single formatted banner', () => {
    // Arrange
    const multiErrorConfig = {
      ...baseValidConfig,
      botToken: '',
      databaseEncryptionKey: '',
    };

    // Act & Assert
    expect(() => validateStartupEnv(multiErrorConfig)).toThrow(
      /FATAL CONFIG ERROR[\s\S]*BOT_TOKEN[\s\S]*DATABASE_ENCRYPTION_KEY/i
    );
    expect(multiErrorConfig.botToken).toBe('');
    expect(multiErrorConfig.databaseEncryptionKey).toBe('');
  });
});

describe('Dashboard Auth Environment Validation (validateDashboardAuthEnv)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  it('validates default localtest.me and tunnel URLs correctly', () => {
    // Arrange
    delete process.env.DASHBOARD_LOCAL_URL;
    delete process.env.DASHBOARD_TUNNEL_URL;
    delete process.env.DASHBOARD_URL;
    delete process.env.ADMIN_DASHBOARD_URL;

    // Act
    const origins = validateDashboardAuthEnv();

    // Assert
    expect(origins.localOrigin).toBe('http://localtest.me:3002');
    expect(origins.tunnelOrigin).toBe('https://panel.alsaada.org');
    expect(origins.localOrigin).not.toContain('localhost');
  });

  it('accepts custom valid localtest.me port and HTTPS tunnel URL', () => {
    // Arrange
    process.env.DASHBOARD_LOCAL_URL = 'http://localtest.me:4000';
    process.env.DASHBOARD_TUNNEL_URL = 'https://custom-tunnel.ngrok-free.app';

    // Act
    const origins = validateDashboardAuthEnv();

    // Assert
    expect(origins.localOrigin).toBe('http://localtest.me:4000');
    expect(origins.tunnelOrigin).toBe('https://custom-tunnel.ngrok-free.app');
    expect(origins.tunnelOrigin).toMatch(/^https:\/\//);
  });

  it('throws DashboardAuthConfigError when DASHBOARD_LOCAL_URL is invalid (e.g. nip.io or localhost)', () => {
    // Arrange
    process.env.DASHBOARD_LOCAL_URL = 'http://127.0.0.1.nip.io:3002';

    // Act & Assert
    expect(() => validateDashboardAuthEnv()).toThrow(DashboardAuthConfigError);

    // Arrange 2
    process.env.DASHBOARD_LOCAL_URL = 'http://localhost:3002';

    // Act & Assert 2
    expect(() => validateDashboardAuthEnv()).toThrow(DashboardAuthConfigError);
    expect(process.env.DASHBOARD_LOCAL_URL).not.toContain('localtest.me');
  });

  it('throws DashboardAuthConfigError when DASHBOARD_TUNNEL_URL is not HTTPS', () => {
    // Arrange
    process.env.DASHBOARD_LOCAL_URL = 'http://localtest.me:3002';
    process.env.DASHBOARD_TUNNEL_URL = 'http://insecure-tunnel.example.com';

    // Act & Assert
    expect(() => validateDashboardAuthEnv()).toThrow(DashboardAuthConfigError);
    expect(process.env.DASHBOARD_TUNNEL_URL).not.toMatch(/^https:\/\//);
  });
});
