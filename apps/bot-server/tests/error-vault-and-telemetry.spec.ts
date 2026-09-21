import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

const { mockRedisStore, mockPrisma } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const prisma = {
    botPerformanceLog: {
      create: vi.fn().mockResolvedValue({ id: 'perf-1' }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'perf-1',
          executionTimeMs: 10,
          performanceTier: 'GREEN_FAST',
          callbackQueryOrCommand: 'action:test',
          actorTelegramId: 111n,
          createdAt: new Date('2026-09-21T12:00:00.000Z'),
        },
        {
          id: 'perf-2',
          executionTimeMs: 120,
          performanceTier: 'YELLOW_ACCEPTABLE',
          callbackQueryOrCommand: 'action:slow',
          actorTelegramId: 222n,
          createdAt: new Date('2026-09-21T12:00:00.000Z'),
        },
        {
          id: 'perf-3',
          executionTimeMs: 300,
          performanceTier: 'RED_SLOW',
          callbackQueryOrCommand: 'action:very_slow',
          actorTelegramId: 333n,
          createdAt: new Date('2026-09-21T12:00:00.000Z'),
        },
      ]),
    },
    systemErrorLog: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([
        { telegramId: 999999n, role: 'SUPER_ADMIN', fullName: 'Super Admin' },
      ]),
    },
  };
  return { mockRedisStore: store, mockPrisma: prisma };
});

vi.mock('../src/config/env.js', () => ({
  config: {
    superAdminTelegramId: 999999n,
  },
}));

vi.mock('../src/redis.js', () => ({
  redis: {
    on: vi.fn(),
    get: vi.fn().mockImplementation((key: string) => Promise.resolve(mockRedisStore.get(key) || null)),
    set: vi.fn().mockImplementation((key: string, val: string) => {
      mockRedisStore.set(key, val);
      return Promise.resolve('OK');
    }),
  },
  safeRedisGet: vi.fn().mockImplementation((key: string) => Promise.resolve(mockRedisStore.get(key) || null)),
  safeRedisSet: vi.fn().mockImplementation((key: string, val: string) => {
    mockRedisStore.set(key, val);
    return Promise.resolve(true);
  }),
}));

vi.mock('../src/db.js', () => ({
  prisma: mockPrisma,
}));

import { TelemetryService } from '../src/services/telemetry.service.js';
import { ErrorVaultService } from '../src/services/error-vault.service.js';
import { telemetryMiddleware } from '../src/middlewares/telemetry.middleware.js';
import type { MyContext } from '../src/types/context.js';

describe('⚡ Telemetry & APM Service', () => {
  let telemetry: TelemetryService;

  beforeEach(() => {
    mockRedisStore.clear();
    vi.clearAllMocks();
    telemetry = new TelemetryService();
  });

  it('records user breadcrumbs up to 5 FIFO entries', async () => {
    // Arrange
    const userId = 12345n;

    // Act
    for (let i = 1; i <= 7; i++) {
      await telemetry.recordBreadcrumb(userId, `action:step_${i}`);
    }
    const breadcrumbs = await telemetry.getBreadcrumbs(userId);

    // Assert
    expect(breadcrumbs).toHaveLength(5);
    expect(breadcrumbs[0]?.action).toBe('action:step_3');
    expect(breadcrumbs[4]?.action).toBe('action:step_7');
    expect(breadcrumbs.some((b) => b.action === 'action:step_1')).toBe(false);
  });

  it('classifies and records performance tiers correctly', async () => {
    // Arrange & Act 1: Fast
    await telemetry.recordPerformance({
      actorTelegramId: 123n,
      callbackQueryOrCommand: 'action:fast',
      executionTimeMs: 12,
    });

    // Assert 1
    expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        performanceTier: 'GREEN_FAST',
        executionTimeMs: 12,
      }),
    });

    // Arrange & Act 2: Medium
    await telemetry.recordPerformance({
      actorTelegramId: 123n,
      callbackQueryOrCommand: 'action:medium',
      executionTimeMs: 150,
    });

    // Assert 2
    expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        performanceTier: 'YELLOW_ACCEPTABLE',
        executionTimeMs: 150,
      }),
    });

    // Arrange & Act 3: Slow
    await telemetry.recordPerformance({
      actorTelegramId: 123n,
      callbackQueryOrCommand: 'action:slow',
      executionTimeMs: 400,
    });

    // Assert 3
    expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        performanceTier: 'RED_SLOW',
        executionTimeMs: 400,
      }),
    });
    expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledTimes(3);
  });

  it('computes 24h performance summary and percentiles', async () => {
    // Arrange & Act
    const summary = await telemetry.getPerformanceSummary24h();

    // Assert
    expect(summary.totalOps).toBe(3);
    expect(summary.avgLatencyMs).toBe(143);
    expect(summary.greenPct).toBe(33);
    expect(summary.yellowPct).toBe(33);
    expect(summary.redPct).toBe(33);
    expect(summary.slowestOps).toHaveLength(3);
    expect(summary.slowestOps[0]?.action).toBe('action:very_slow');
    expect(summary.slowestOps[0]?.action).not.toBe('action:test');
  });

  it('caches and retrieves Telegram file_ids in memory', () => {
    // Arrange
    const docKey = 'doc-1';
    const fileId = 'file_abc_123';

    // Act
    telemetry.setCachedFileId(docKey, fileId);

    // Assert
    expect(telemetry.getCachedFileId(docKey)).toBe(fileId);
    expect(telemetry.getCachedFileId('unknown')).toBeUndefined();
    expect(telemetry.getCachedFileId(docKey)).not.toBe('unknown');
  });
});

describe('🛡️ Centralized Error Vault Service', () => {
  let vault: ErrorVaultService;
  let telemetry: TelemetryService;

  beforeEach(() => {
    mockRedisStore.clear();
    vi.clearAllMocks();
    telemetry = new TelemetryService();
    vault = new ErrorVaultService();
  });

  it('persists only a normalized sanitized incident with a full fingerprint', async () => {
    // Arrange
    mockPrisma.systemErrorLog.findFirst.mockResolvedValue(null);
    mockPrisma.systemErrorLog.create.mockResolvedValue({
      id: 'err-sanitized',
      errorReference: '#ERR-SAFE',
      occurrenceCount: 1,
      severity: 'ERROR',
      errorMessage: 'sanitized',
      breadcrumbs: [],
    });

    // Act
    await vault.recordError({
      error: new Error(
        'Authorization: Bearer raw-secret password=database-secret 29801011234567',
      ),
      sourceLocation: 'test:sanitize',
      traceId: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
    });

    // Assert
    const createCall = mockPrisma.systemErrorLog.create.mock.calls[0]?.[0];
    expect(createCall).toBeDefined();
    const data = createCall?.data as Record<string, unknown>;
    expect(data.errorHash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.traceId).toBe('a1b2c3d4-e5f6-4789-abcd-ef0123456789');
    expect(String(data.errorMessage)).not.toContain('raw-secret');
    expect(String(data.errorMessage)).not.toContain('database-secret');
    expect(String(data.errorMessage)).not.toContain('29801011234567');
    expect(String(data.stackTrace)).not.toContain('raw-secret');
  });

  it('uses the bounded emergency sink when incident persistence is unavailable', async () => {
    // Arrange
    mockPrisma.systemErrorLog.findFirst.mockRejectedValueOnce(
      new Error('password=database-secret token=raw-token'),
    );
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const traceId = 'b1b2c3d4-e5f6-4789-abcd-ef0123456789';

    // Act & Assert
    try {
      await expect(
        vault.recordError({
          error: new Error('Authorization: Bearer raw-secret'),
          sourceLocation: 'test:persistence-failure',
          traceId,
        }),
      ).rejects.toThrow();

      const output = stderrSpy.mock.calls.map((call) => String(call[0])).join('');
      expect(output).toContain('telemetry-emergency-sink');
      expect(output).toContain(traceId);
      expect(output).not.toContain('database-secret');
      expect(output).not.toContain('raw-token');
      expect(output).not.toContain('raw-secret');
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('records new error and alerts super admin', async () => {
    // Arrange
    mockPrisma.systemErrorLog.findFirst.mockResolvedValue(null);
    mockPrisma.systemErrorLog.create.mockResolvedValue({
      id: 'err-row-1',
      errorReference: '#ERR-1234',
      occurrenceCount: 1,
      severity: 'CRITICAL',
      actorTelegramId: 777n,
      actorRole: 'ADMIN',
      actionTrigger: 'action:break_something',
      sourceLocation: 'bot.catch:global',
      errorMessage: 'Database connection failed',
      breadcrumbs: [],
    });

    const mockApi = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 888 }),
    };

    const mockCtx = {
      chat: { id: 777 },
      from: { id: 777, first_name: 'TestUser' },
      session: { user: { role: 'ADMIN' } },
      callbackQuery: { data: 'action:break_something' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue({ message_id: 999 }),
    };

    const error = new Error('Database connection failed');

    // Act
    const log = await vault.recordError({
      ctx: mockCtx as unknown as MyContext,
      error,
      sourceLocation: 'bot.catch:global',
      severity: 'CRITICAL',
      api: mockApi as any,
    });

    // Assert
    expect(log.errorReference).toBe('#ERR-1234');
    expect(mockPrisma.systemErrorLog.create).toHaveBeenCalled();
    // Super admin alerted
    expect(mockApi.sendMessage).toHaveBeenCalledWith(
      999999,
      expect.stringContaining('[إنذار أمني وعطل برمجي جديد في البوت]'),
      expect.any(Object)
    );

    // Test global bot error handler sending user-facing card
    await vault.handleGlobalBotError({ ctx: mockCtx as unknown as MyContext, error } as any, mockApi as any);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('عذراً، حدث خطأ غير متوقع'),
      expect.objectContaining({
        parse_mode: 'HTML',
        reply_markup: expect.any(Object),
      })
    );
  });

  it('sends plain-text fallback when rich HTML card reply fails', async () => {
    // Arrange
    mockPrisma.systemErrorLog.findFirst.mockResolvedValue(null);
    mockPrisma.systemErrorLog.create.mockResolvedValue({
      id: 'err-row-fallback',
      errorReference: '#ERR-FB01',
      occurrenceCount: 1,
      severity: 'CRITICAL',
      actorTelegramId: 777n,
      actorRole: 'ADMIN',
      actionTrigger: 'action:crash',
      sourceLocation: 'bot.catch:global',
      errorMessage: 'HTML parsing simulated failure',
      breadcrumbs: [],
    });

    const mockApi = { sendMessage: vi.fn().mockResolvedValue({}) };
    const mockCtx = {
      chat: { id: 777 },
      from: { id: 777, first_name: 'TestUser' },
      reply: vi
        .fn()
        .mockRejectedValueOnce(new Error('Bad Request: can\'t parse entities in HTML'))
        .mockResolvedValueOnce({ message_id: 1000 }),
    };

    const error = new Error('HTML parsing simulated failure');

    // Act
    await vault.handleGlobalBotError({ ctx: mockCtx as unknown as MyContext, error } as any, mockApi as any);

    // Assert
    // First call failed (rich HTML card), second call is plain-text fallback
    expect(mockCtx.reply).toHaveBeenCalledTimes(2);
    expect(mockCtx.reply).toHaveBeenLastCalledWith(
      expect.stringContaining('⚠️ حدث خطأ غير متوقع أثناء معالجة طلبك.\nرمز البلاغ: #ERR-FB01\nيرجى إبلاغ الدعم الفني.')
    );
    expect(mockCtx.reply).not.toHaveBeenCalledTimes(3);
  });

  it('writes to process.stderr if even the plain-text fallback fails', async () => {
    // Arrange
    mockPrisma.systemErrorLog.findFirst.mockResolvedValue(null);
    mockPrisma.systemErrorLog.create.mockResolvedValue({
      id: 'err-row-fatal',
      errorReference: '#ERR-FATAL',
      occurrenceCount: 1,
      severity: 'CRITICAL',
      actorTelegramId: 777n,
      actorRole: 'ADMIN',
      actionTrigger: 'action:crash',
      sourceLocation: 'bot.catch:global',
      errorMessage: 'Complete connection failure',
      breadcrumbs: [],
    });

    const mockApi = { sendMessage: vi.fn().mockResolvedValue({}) };
    const mockCtx = {
      chat: { id: 777 },
      from: { id: 777, first_name: 'TestUser' },
      reply: vi.fn().mockRejectedValue(new Error('Network disconnected')),
    };

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const error = new Error('Complete connection failure');

    // Act
    try {
      await vault.handleGlobalBotError({ ctx: mockCtx as unknown as MyContext, error } as any, mockApi as any);

      // Assert
      const emergencyOutput = stderrSpy.mock.calls.map((call) => String(call[0])).join('');
      expect(emergencyOutput).toContain('telemetry-emergency-sink');
      expect(emergencyOutput).not.toContain('Network disconnected');
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('deduplicates and throttles alerts on recurring errors', async () => {
    // Arrange
    mockPrisma.systemErrorLog.findFirst.mockResolvedValueOnce({
      id: 'existing-err',
      errorReference: '#ERR-9999',
      occurrenceCount: 2, // Next will be 3 (not a milestone: 1, 5, 10, 25, 50, 100)
    });
    mockPrisma.systemErrorLog.update.mockResolvedValueOnce({
      id: 'existing-err',
      errorReference: '#ERR-9999',
      occurrenceCount: 3,
    });

    const mockApi = {
      sendMessage: vi.fn(),
    };

    const mockCtx = {
      chat: { id: 777 },
      from: { id: 777 },
      reply: vi.fn().mockResolvedValue({}),
    };

    // Act
    const log = await vault.recordError({
      ctx: mockCtx as unknown as MyContext,
      error: new Error('Repeated crash'),
      sourceLocation: 'bot.catch:global',
      api: mockApi as any,
    });

    // Assert
    expect(log.errorReference).toBe('#ERR-9999');
    expect(mockPrisma.systemErrorLog.update).toHaveBeenCalledWith({
      where: { id: 'existing-err' },
      data: expect.objectContaining({
        occurrenceCount: { increment: 1 },
      }),
    });
    // Should NOT spam super admin on 3rd occurrence
    expect(mockApi.sendMessage).not.toHaveBeenCalled();
  });

  it('resolves an error successfully', async () => {
    // Arrange
    mockPrisma.systemErrorLog.update.mockResolvedValueOnce({
      id: 'err-123',
      isResolved: true,
    });

    // Act
    await vault.resolveError('err-123', 999999n);

    // Assert
    expect(mockPrisma.systemErrorLog.update).toHaveBeenCalledWith({
      where: { id: 'err-123' },
      data: {
        isResolved: true,
        resolvedAt: expect.any(Date),
        resolvedById: 999999n,
      },
    });
    expect(mockPrisma.systemErrorLog.update).toHaveBeenCalledTimes(1);
  });
});

describe('🛰️ Telemetry Middleware', () => {
  it('records breadcrumb and measures latency in middleware', async () => {
    // Arrange
    const next = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const ctx = {
      from: { id: 55555 },
      callbackQuery: { data: 'action:click_button' },
    };

    // Act
    await telemetryMiddleware(ctx as unknown as MyContext, next);

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorTelegramId: 55555n,
        callbackQueryOrCommand: 'cb:action:click_button',
      }),
    });
  });
});
