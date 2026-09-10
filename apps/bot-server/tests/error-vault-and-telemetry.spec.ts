import { describe, it, expect, vi, beforeEach } from 'vitest';

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
          createdAt: new Date(),
        },
        {
          id: 'perf-2',
          executionTimeMs: 120,
          performanceTier: 'YELLOW_ACCEPTABLE',
          callbackQueryOrCommand: 'action:slow',
          actorTelegramId: 222n,
          createdAt: new Date(),
        },
        {
          id: 'perf-3',
          executionTimeMs: 300,
          performanceTier: 'RED_SLOW',
          callbackQueryOrCommand: 'action:very_slow',
          actorTelegramId: 333n,
          createdAt: new Date(),
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
import {
  renderErrorLogsList,
  renderErrorLogDetail,
  handleResolveError,
  renderPerformanceDashboard,
} from '../src/handlers/error-console.handler.js';
import type { MyContext } from '../src/types/context.js';

describe('⚡ Telemetry & APM Service', () => {
  let telemetry: TelemetryService;

  beforeEach(() => {
    mockRedisStore.clear();
    vi.clearAllMocks();
    telemetry = new TelemetryService();
  });

  it('should record user breadcrumbs up to 5 FIFO entries', async () => {
    const userId = 12345n;
    for (let i = 1; i <= 7; i++) {
      await telemetry.recordBreadcrumb(userId, `action:step_${i}`);
    }

    const breadcrumbs = await telemetry.getBreadcrumbs(userId);
    expect(breadcrumbs).toHaveLength(5);
    expect(breadcrumbs[0]?.action).toBe('action:step_3');
    expect(breadcrumbs[4]?.action).toBe('action:step_7');
  });

  it('should classify and record performance tiers correctly', async () => {
    await telemetry.recordPerformance({
      actorTelegramId: 123n,
      callbackQueryOrCommand: 'action:fast',
      executionTimeMs: 12,
    });

    expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        performanceTier: 'GREEN_FAST',
        executionTimeMs: 12,
      }),
    });

    await telemetry.recordPerformance({
      actorTelegramId: 123n,
      callbackQueryOrCommand: 'action:medium',
      executionTimeMs: 150,
    });

    expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        performanceTier: 'YELLOW_ACCEPTABLE',
        executionTimeMs: 150,
      }),
    });

    await telemetry.recordPerformance({
      actorTelegramId: 123n,
      callbackQueryOrCommand: 'action:slow',
      executionTimeMs: 400,
    });

    expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        performanceTier: 'RED_SLOW',
        executionTimeMs: 400,
      }),
    });
  });

  it('should compute 24h performance summary and percentiles', async () => {
    const summary = await telemetry.getPerformanceSummary24h();
    expect(summary.totalOps).toBe(3);
    expect(summary.avgLatencyMs).toBe(143);
    expect(summary.greenPct).toBe(33);
    expect(summary.yellowPct).toBe(33);
    expect(summary.redPct).toBe(33);
    expect(summary.slowestOps).toHaveLength(3);
    expect(summary.slowestOps[0]?.action).toBe('action:very_slow');
  });

  it('should cache and retrieve Telegram file_ids in memory', () => {
    telemetry.setCachedFileId('doc-1', 'file_abc_123');
    expect(telemetry.getCachedFileId('doc-1')).toBe('file_abc_123');
    expect(telemetry.getCachedFileId('unknown')).toBeUndefined();
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

  it('should record new error and alert super admin', async () => {
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

    const log = await vault.recordError({
      ctx: mockCtx as unknown as MyContext,
      error,
      sourceLocation: 'bot.catch:global',
      severity: 'CRITICAL',
      api: mockApi as any,
    });

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
        reply_markup: expect.any(Object),
      })
    );
  });

  it('should deduplicate and throttle alerts on recurring errors', async () => {
    // Existing active error found
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

    const log = await vault.recordError({
      ctx: mockCtx as unknown as MyContext,
      error: new Error('Repeated crash'),
      sourceLocation: 'bot.catch:global',
      api: mockApi as any,
    });

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

  it('should resolve an error successfully', async () => {
    mockPrisma.systemErrorLog.update.mockResolvedValueOnce({
      id: 'err-123',
      isResolved: true,
    });

    await vault.resolveError('err-123', 999999n);

    expect(mockPrisma.systemErrorLog.update).toHaveBeenCalledWith({
      where: { id: 'err-123' },
      data: {
        isResolved: true,
        resolvedAt: expect.any(Date),
        resolvedById: 999999n,
      },
    });
  });
});

describe('🛰️ Telemetry Middleware', () => {
  it('should record breadcrumb and measure latency', async () => {
    const next = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const ctx = {
      from: { id: 55555 },
      callbackQuery: { data: 'action:click_button' },
    };

    await telemetryMiddleware(ctx as unknown as MyContext, next);

    expect(next).toHaveBeenCalled();
    expect(mockPrisma.botPerformanceLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorTelegramId: 55555n,
        callbackQueryOrCommand: 'cb:action:click_button',
      }),
    });
  });
});

describe('🖥️ Error Console & APM Handlers', () => {
  let mockCtx: {
    isRealSuperAdmin: boolean;
    from: { id: number };
    callbackQuery: { data: string };
    answerCallbackQuery: ReturnType<typeof vi.fn>;
    editMessageText: ReturnType<typeof vi.fn>;
    reply: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCtx = {
      isRealSuperAdmin: true,
      from: { id: 999999 },
      callbackQuery: { data: 'action:dummy' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockResolvedValue(true),
    };
  });

  it('should deny non-super-admin from error logs', async () => {
    mockCtx.isRealSuperAdmin = false;
    await renderErrorLogsList(mockCtx as unknown as MyContext);
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({ show_alert: true })
    );
    expect(mockCtx.editMessageText).not.toHaveBeenCalled();
  });

  it('should render error logs list for Super Admin', async () => {
    mockPrisma.systemErrorLog.findMany.mockResolvedValueOnce([
      {
        id: 'err-1',
        errorReference: '#ERR-4444',
        actionTrigger: 'action:test',
        occurrenceCount: 1,
        isResolved: false,
      },
    ]);

    await renderErrorLogsList(mockCtx as unknown as MyContext, 1, true);

    expect(mockCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('سجل مراقبة الأعطال والأخطاء المركزية'),
      expect.objectContaining({
        reply_markup: expect.any(Object),
      })
    );
  });

  it('should render error log details with breadcrumbs', async () => {
    mockPrisma.systemErrorLog.findUnique.mockResolvedValueOnce({
      id: 'err-1',
      errorReference: '#ERR-4444',
      severity: 'CRITICAL',
      occurrenceCount: 2,
      createdAt: new Date('2026-09-10T00:00:00Z'),
      lastSeenAt: new Date('2026-09-10T01:00:00Z'),
      isResolved: false,
      actorTelegramId: 12345n,
      actorRole: 'ADMIN',
      actionTrigger: 'action:crash',
      sourceLocation: 'src/bot.ts:50',
      errorMessage: 'Sample failure details',
      breadcrumbs: [{ action: 'action:step1' }, { action: 'action:step2' }],
    });

    await renderErrorLogDetail(mockCtx as unknown as MyContext, 'err-1', true);

    expect(mockCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('تفاصيل البلاغ الجنائي للعطل (#ERR-4444)'),
      expect.objectContaining({
        reply_markup: expect.any(Object),
      })
    );
  });

  it('should handle resolving an error', async () => {
    mockPrisma.systemErrorLog.update.mockResolvedValueOnce({ id: 'err-1', isResolved: true });
    mockPrisma.systemErrorLog.findUnique.mockResolvedValueOnce({
      id: 'err-1',
      errorReference: '#ERR-4444',
      severity: 'CRITICAL',
      occurrenceCount: 1,
      createdAt: new Date(),
      lastSeenAt: new Date(),
      isResolved: true,
      actorTelegramId: 12345n,
      actorRole: 'ADMIN',
      actionTrigger: 'action:crash',
      errorMessage: 'Fixed',
      breadcrumbs: [],
    });

    await handleResolveError(mockCtx as unknown as MyContext, 'err-1');

    expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('تم اعتماد حل المشكلة'),
      })
    );
  });

  it('should render APM performance dashboard', async () => {
    await renderPerformanceDashboard(mockCtx as unknown as MyContext, true);

    expect(mockCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('لوحة مؤشرات الأداء والسرعة اللحظية (APM Dashboard)'),
      expect.objectContaining({
        reply_markup: expect.any(Object),
      })
    );
  });
});
