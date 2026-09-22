import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWithTelemetryContext } from '../src/context.js';
import { TelemetryLogger } from '../src/logger.js';
import type { TelemetryContext } from '../src/types.js';

describe('TelemetryLogger', () => {
  const PINNED_BASE_TIME = new Date('2026-03-03T12:00:00.000Z');
  let stdoutSpy: any;
  let stderrSpy: any;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  it('respects minLevel filtering', () => {
    // Arrange
    const logger = new TelemetryLogger({ minLevel: 'warn' });

    // Act
    const d = logger.debug('debug message');
    const i = logger.info('info message');
    const w = logger.warn('warn message');

    // Assert
    expect(d).toBeUndefined();
    expect(i).toBeUndefined();
    expect(w).toBeDefined();
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledTimes(1);
  });

  it('routes info and debug to stdout, and warn, error, fatal to stderr', () => {
    // Arrange
    const logger = new TelemetryLogger({ minLevel: 'debug' });

    // Act
    logger.debug('debug log');
    logger.info('info log');
    const stdoutCount = stdoutSpy.mock.calls.length;
    const stderrCountBeforeWarn = stderrSpy.mock.calls.length;

    logger.warn('warn log');
    logger.error('error log');
    logger.fatal('fatal log');
    const stderrCountTotal = stderrSpy.mock.calls.length;

    // Assert
    expect(stdoutCount).toBe(2);
    expect(stderrCountBeforeWarn).toBe(0);
    expect(stderrCountTotal).toBe(3);
  });

  it('automatically merges active TelemetryContext from AsyncLocalStorage', () => {
    // Arrange
    const logger = new TelemetryLogger();
    const ctx: TelemetryContext = {
      traceId: 'auto-trace-ctx-999',
      service: 'bot-server',
      component: 'bot:gateway',
      action: 'cmd:/start',
      actor: {
        telegramId: '7594239391',
        role: 'SUPER_ADMIN',
      },
    };

    // Act
    const entry = runWithTelemetryContext(ctx, () => {
      return logger.info('User started bot', {
        payload: { extra: 'detail' },
      });
    });

    // Assert
    expect(entry).toBeDefined();
    expect(entry?.traceId).toBe('auto-trace-ctx-999');
    expect(entry?.service).toBe('bot-server');
    expect(entry?.component).toBe('bot:gateway');
    expect(entry?.action).toBe('cmd:/start');
    expect(entry?.actor?.telegramId).toBe('7594239391');
    expect(entry?.actor?.role).toBe('SUPER_ADMIN');
    expect(entry?.payload).toEqual({ extra: 'detail' });
  });

  it('automatically redacts sensitive keys and values in message, payload, actor, and error', () => {
    // Arrange
    const logger = new TelemetryLogger();
    const errorInput = {
      actor: {
        telegramId: '7594239391',
        ipAddress: '127.0.0.1',
      },
      payload: {
        botToken: 'secretTokenValue',
        databaseUrl: 'postgresql://admin:password123@localhost:5432/db',
        safeProperty: 'unaffected',
      },
      error: new Error('Failed connecting to redis://:redisPass123@redis:6379'),
    };

    // Act
    const entry = logger.error('Connection failed for bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789', errorInput);
    const writtenLine = stderrSpy.mock.calls[0]?.[0] as string;
    const parsed = writtenLine ? JSON.parse(writtenLine) : null;

    // Assert
    expect(entry).toBeDefined();
    expect(entry?.message).toContain('[REDACTED_BOT_TOKEN]');
    expect(entry?.payload).toMatchObject({
      botToken: '[REDACTED]',
      databaseUrl: '[REDACTED]',
      safeProperty: 'unaffected',
    });
    expect(entry?.error?.message).toContain('[REDACTED_PASSWORD]');
    expect(entry?.error?.message).not.toContain('redisPass123');
    expect(parsed).toBeDefined();
    expect(parsed?.level).toBe('error');
    expect(parsed?.traceId).toBe(entry?.traceId);
  });

  it('formats non-Error error structures cleanly', () => {
    // Arrange
    const logger = new TelemetryLogger();
    const rawError = 'raw string failure with key AIzaSy123456789012345678901234567890123' as unknown as Error;

    // Act
    const entry = logger.error('String error event', {
      error: rawError,
    });

    // Assert
    expect(entry?.error?.name).toBe('UnknownError');
    expect(entry?.error?.message).toContain('[REDACTED_API_KEY]');
  });
});
