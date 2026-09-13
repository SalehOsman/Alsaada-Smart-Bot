import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWithTelemetryContext } from '../src/context.js';
import { TelemetryLogger } from '../src/logger.js';
import type { TelemetryContext } from '../src/types.js';

describe('TelemetryLogger', () => {
  let stdoutSpy: any;
  let stderrSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('respects minLevel filtering', () => {
    const logger = new TelemetryLogger({ minLevel: 'warn' });

    const d = logger.debug('debug message');
    const i = logger.info('info message');
    const w = logger.warn('warn message');

    expect(d).toBeUndefined();
    expect(i).toBeUndefined();
    expect(w).toBeDefined();

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledTimes(1);
  });

  it('routes info and debug to stdout, and warn, error, fatal to stderr', () => {
    const logger = new TelemetryLogger({ minLevel: 'debug' });

    logger.debug('debug log');
    logger.info('info log');
    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    expect(stderrSpy).not.toHaveBeenCalled();

    logger.warn('warn log');
    logger.error('error log');
    logger.fatal('fatal log');
    expect(stderrSpy).toHaveBeenCalledTimes(3);
  });

  it('automatically merges active TelemetryContext from AsyncLocalStorage', () => {
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

    runWithTelemetryContext(ctx, () => {
      const entry = logger.info('User started bot', {
        payload: { extra: 'detail' },
      });

      expect(entry).toBeDefined();
      expect(entry?.traceId).toBe('auto-trace-ctx-999');
      expect(entry?.service).toBe('bot-server');
      expect(entry?.component).toBe('bot:gateway');
      expect(entry?.action).toBe('cmd:/start');
      expect(entry?.actor?.telegramId).toBe('7594239391');
      expect(entry?.actor?.role).toBe('SUPER_ADMIN');
      expect(entry?.payload).toEqual({ extra: 'detail' });
    });
  });

  it('automatically redacts sensitive keys and values in message, payload, actor, and error', () => {
    const logger = new TelemetryLogger();

    const entry = logger.error('Connection failed for bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789', {
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
    });

    expect(entry).toBeDefined();
    // Message scrubbed
    expect(entry?.message).toContain('[REDACTED_BOT_TOKEN]');
    // Payload keys and values scrubbed
    expect(entry?.payload).toMatchObject({
      botToken: '[REDACTED]',
      databaseUrl: '[REDACTED]',
      safeProperty: 'unaffected',
    });
    // Error message scrubbed
    expect(entry?.error?.message).toContain('[REDACTED_PASSWORD]');
    expect(entry?.error?.message).not.toContain('redisPass123');

    // JSON written to stderr must be valid JSON
    const writtenLine = stderrSpy.mock.calls[0]?.[0] as string;
    expect(writtenLine).toBeDefined();
    const parsed = JSON.parse(writtenLine);
    expect(parsed.level).toBe('error');
    expect(parsed.traceId).toBe(entry?.traceId);
  });

  it('formats non-Error error structures cleanly', () => {
    const logger = new TelemetryLogger();
    const entry = logger.error('String error event', {
      error: 'raw string failure with key AIzaSy123456789012345678901234567890123' as unknown as Error,
    });

    expect(entry?.error?.name).toBe('UnknownError');
    expect(entry?.error?.message).toContain('[REDACTED_API_KEY]');
  });
});
