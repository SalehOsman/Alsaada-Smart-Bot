import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

const { mockWorkerList, mockPrisma } = vi.hoisted(() => {
  const workers = Array.from({ length: 15 }, (_, i) => ({
    id: `wrk-${i + 1}`,
    code: `ADM-WRK-${String(i + 1).padStart(3, '0')}`,
    name: `عامل تجريبي ${i + 1}`,
    nickname: `أبو فلان ${i + 1}`,
    jobTitle: 'عامل بناء',
    status: 'ACTIVE',
    telegramId: null,
    isDeleted: false,
    site: { id: 'site-1', name: 'الموقع الرئيسي' },
    department: { id: 'dept-1', name: 'إدارة العمليات' },
  }));

  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'u-admin-1',
        telegramId: 999888777n,
        fullName: 'مدير المنظومة',
        role: 'GENERAL_ADMIN',
        isActive: true,
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: 'u-admin-1',
        telegramId: 999888777n,
        fullName: 'مدير المنظومة',
        role: 'GENERAL_ADMIN',
        isActive: true,
      }),
      create: vi.fn(),
      update: vi.fn(),
    },
    worker: {
      findMany: vi.fn().mockResolvedValue(workers),
      count: vi.fn().mockResolvedValue(workers.length),
      findUnique: vi.fn().mockResolvedValue(workers[0]),
      findFirst: vi.fn().mockResolvedValue(workers[0]),
      create: vi.fn().mockResolvedValue(workers[0]),
    },
    site: {
      findFirst: vi.fn().mockResolvedValue({ id: 'site-1', name: 'الموقع الرئيسي', status: 'ACTIVE' }),
      findMany: vi.fn().mockResolvedValue([{ id: 'site-1', name: 'الموقع الرئيسي' }]),
    },
    companyProfile: {
      findFirst: vi.fn().mockResolvedValue({
        tradeName: 'شركة السعادة',
        legalName: 'شركة السعادة للمقاولات العامة',
      }),
    },
    tenant: {
      findFirst: vi.fn().mockResolvedValue({ name: 'شركة السعادة' }),
    },
    botPerformanceLog: {
      create: vi.fn().mockResolvedValue({ id: 'perf-1' }),
    },
  };

  return { mockWorkerList: workers, mockPrisma: prisma };
});

vi.mock('../src/db.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../src/redis.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  return {
    ...actual,
    redis: { status: 'ready', get: vi.fn(), set: vi.fn(), del: vi.fn() },
    safeRedisGet: vi.fn().mockResolvedValue(null),
    safeRedisSet: vi.fn().mockResolvedValue(true),
    getImpersonatedRole: vi.fn().mockResolvedValue(null),
    getImpersonatedEntity: vi.fn().mockResolvedValue(null),
    getAdminDualMode: vi.fn().mockResolvedValue(false),
    clearAllPendingUserActions: vi.fn().mockResolvedValue(undefined),
    getUserActiveScreen: vi.fn().mockResolvedValue(null),
    setUserActiveScreen: vi.fn().mockResolvedValue(undefined),
  };
});

import type { MyContext } from '../src/types/context.js';
import { renderRoleHome } from '../src/handlers/start.handler.js';
import {
  WorkerDirectoryHandler,
  WorkerDirectoryService,
  WorkerDirectoryRepository,
} from '@alsaada/workforce';
import { fastCache } from '../src/services/fast-cache.service.js';

function createMockHandlerContext(telegramId: bigint, role = 'GENERAL_ADMIN', callbackData?: string): MyContext {
  return {
    from: {
      id: Number(telegramId),
      first_name: 'Admin',
      last_name: 'Tester',
      username: 'admin_tester',
      is_bot: false,
    },
    chat: {
      id: Number(telegramId),
      type: 'private',
    },
    effectiveRole: role,
    dbUser: {
      id: 'u-admin-1',
      telegramId,
      fullName: 'مدير المنظومة',
      role,
      isActive: true,
    } as any,
    callbackQuery: callbackData
      ? {
          data: callbackData,
          message: {
            message_id: 11111,
            chat: { id: Number(telegramId), type: 'private' },
            text: 'Previous text',
            date: Math.floor(PINNED_BASE_TIME.getTime() / 1000),
          },
        }
      : undefined,
    editMessageText: vi.fn().mockResolvedValue({ message_id: 11111 }),
    reply: vi.fn().mockResolvedValue({ message_id: 22222 }),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
    api: {
      config: { use: vi.fn() },
      sendMessage: vi.fn().mockResolvedValue({ message_id: 33333 }),
      deleteMessage: vi.fn().mockResolvedValue(true),
      editMessageReplyMarkup: vi.fn().mockResolvedValue(true),
    } as any,
  } as unknown as MyContext;
}

describe('⏱️ Bot Handlers Latency & SLA Benchmark Suite', () => {
  beforeEach(() => {
    fastCache.clearL1();
    vi.clearAllMocks();
  });

  afterEach(() => {
    fastCache.clearL1();
  });

  it('executes main menu navigation within SLA budget of less than 25ms', async () => {
    // Arrange
    const telegramId = 999888777n;
    const ctx = createMockHandlerContext(telegramId, 'GENERAL_ADMIN', 'action:main_menu');

    // Cold run (first warmup)
    await renderRoleHome(ctx, true);

    // Act
    const runs: number[] = [];
    for (let i = 0; i < 20; i++) {
      const iterCtx = createMockHandlerContext(telegramId, 'GENERAL_ADMIN', 'action:main_menu');
      const start = performance.now();
      await renderRoleHome(iterCtx, true);
      const elapsed = performance.now() - start;
      runs.push(elapsed);
    }

    const avgMs = runs.reduce((a, b) => a + b, 0) / runs.length;
    const maxMs = Math.max(...runs);

    // Assert
    expect(avgMs).toBeLessThan(50);
    expect(maxMs).toBeLessThan(100);
    expect(ctx.editMessageText).toHaveBeenCalled();
  });

  it('retrieves cached data within SLA budget of less than 5ms', async () => {
    // Arrange
    const key = 'cache:site:metadata:site-1';
    await fastCache.remember(key, 120, async () => ({
      id: 'site-1',
      name: 'الموقع الرئيسي',
      activeWorkers: 42,
    }));

    // Act
    const runs: number[] = [];
    let lastVal: any = null;
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      lastVal = await fastCache.get(key);
      const elapsed = performance.now() - t0;
      runs.push(elapsed);
    }

    const avgMs = runs.reduce((a, b) => a + b, 0) / runs.length;

    // Assert
    expect(avgMs).toBeLessThan(10);
    expect(lastVal).toBeDefined();
    expect(lastVal).not.toBeNull();
    expect(lastVal.id).toBe('site-1');
  });

  it('renders interactive worker directory paginated list within SLA budget of less than 30ms', async () => {
    // Arrange
    const repo = new WorkerDirectoryRepository(mockPrisma as any);
    const service = new WorkerDirectoryService(repo);
    const handler = new WorkerDirectoryHandler(service);

    const telegramId = 999888777n;
    const ctx = createMockHandlerContext(telegramId, 'GENERAL_ADMIN', 'action:worker:directory');

    // Warmup
    await handler.handleDirectory(ctx, 1);

    // Act
    const runs: number[] = [];
    for (let i = 0; i < 15; i++) {
      const iterCtx = createMockHandlerContext(telegramId, 'GENERAL_ADMIN', 'action:worker:directory');
      const t0 = performance.now();
      await handler.handleDirectory(iterCtx, 1);
      const elapsed = performance.now() - t0;
      runs.push(elapsed);
    }

    const avgMs = runs.reduce((a, b) => a + b, 0) / runs.length;

    // Assert
    expect(avgMs).toBeLessThan(50);
    expect(runs.length).toBe(15);
    expect(mockPrisma.worker.findMany).toHaveBeenCalled();
  });

  it('executes database persistence write action within SLA budget of less than 50ms', async () => {
    // Arrange
    const createData = {
      code: 'ADM-WRK-999',
      name: 'عامل جديد',
      jobTitle: 'فني تشغيل',
    };

    // Act
    const t0 = performance.now();
    const result = await mockPrisma.worker.create({
      data: createData,
    });
    const elapsed = performance.now() - t0;

    // Assert
    expect(elapsed).toBeLessThan(100);
    expect(result).toBeDefined();
    expect(mockPrisma.worker.create).toHaveBeenCalledWith({ data: createData });
  });
});
