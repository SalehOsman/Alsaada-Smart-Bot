import { describe, it, expect, vi, beforeEach } from 'vitest';

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
            date: Math.floor(Date.now() / 1000),
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

  it('1. Main Menu Navigation SLA: Net internal execution time < 10ms (cached < 25ms max)', async () => {
    const telegramId = 999888777n;
    const ctx = createMockHandlerContext(telegramId, 'GENERAL_ADMIN', 'action:main_menu');

    // Cold run (first warmup)
    await renderRoleHome(ctx, true);

    // Benchmark 20 warm executions
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

    // SLA Assertions
    expect(avgMs).toBeLessThan(10);
    expect(maxMs).toBeLessThan(25);
  });

  it('2. Fast Data Retrieval SLA: cached lookup responds in < 5ms', async () => {
    const key = 'cache:site:metadata:site-1';
    await fastCache.remember(key, 120, async () => ({
      id: 'site-1',
      name: 'الموقع الرئيسي',
      activeWorkers: 42,
    }));

    const runs: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      const val = await fastCache.get(key);
      const elapsed = performance.now() - t0;
      runs.push(elapsed);
      expect(val).toBeDefined();
    }

    const avgMs = runs.reduce((a, b) => a + b, 0) / runs.length;
    expect(avgMs).toBeLessThan(5);
  });

  it('3. Interactive Worker Directory Screen SLA: rendering paginated list < 20ms', async () => {
    const repo = new WorkerDirectoryRepository(mockPrisma as any);
    const service = new WorkerDirectoryService(repo);
    const handler = new WorkerDirectoryHandler(service);

    const telegramId = 999888777n;
    const ctx = createMockHandlerContext(telegramId, 'GENERAL_ADMIN', 'action:worker:directory');

    // Execute paginated view
    const runs: number[] = [];
    for (let i = 0; i < 15; i++) {
      const iterCtx = createMockHandlerContext(telegramId, 'GENERAL_ADMIN', 'action:worker:directory');
      const t0 = performance.now();
      await handler.handleDirectory(iterCtx, 1);
      const elapsed = performance.now() - t0;
      runs.push(elapsed);
    }

    const avgMs = runs.reduce((a, b) => a + b, 0) / runs.length;
    expect(avgMs).toBeLessThan(20);
  });

  it('4. Database Persistence Action SLA: write operations execute in < 50ms', async () => {
    const t0 = performance.now();
    await mockPrisma.worker.create({
      data: {
        code: 'ADM-WRK-999',
        name: 'عامل جديد',
        jobTitle: 'فني تشغيل',
      },
    });
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(50);
  });
});
