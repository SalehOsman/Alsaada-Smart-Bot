import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerDirectoryHandler } from '../flow.handler.js';
import { WorkerDirectoryService } from '../flow.service.js';
import { WorkerDirectoryRepository } from '../flow.repository.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.5 RBAC Tests — Directory Access Control', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('blocks unauthorized roles such as GUEST and WORKER from viewing the directory', async () => {
    // Arrange
    const repo = new WorkerDirectoryRepository({} as PrismaClient);
    const service = new WorkerDirectoryService(repo);
    const handler = new WorkerDirectoryHandler(service);

    const blockedRoles: ('GUEST' | 'WORKER' | 'SUPPLIER')[] = ['GUEST', 'WORKER', 'SUPPLIER'];

    for (const role of blockedRoles) {
      let blockedMessage = false;
      const mockCtx = {
        from: { id: 112233 },
        effectiveRole: role,
        callbackQuery: { id: 'cb-dir-rbac' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockImplementation((text: string) => {
          if (text.includes('لا تملك الصلاحية')) {
            blockedMessage = true;
          }
          return Promise.resolve(true);
        }),
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handleDirectory(mockCtx);

      // Assert
      expect(blockedMessage).toBe(true);
      expect(mockCtx.reply).not.toHaveBeenCalledWith(expect.stringContaining('دليل وسجل العاملين'));
    }
  });

  it('allows authorized roles to access the directory', async () => {
    // Arrange
    const mockPrisma = {
      worker: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerDirectoryRepository(mockPrisma);
    const service = new WorkerDirectoryService(repo);
    const handler = new WorkerDirectoryHandler(service);

    let directoryRendered = false;
    const mockCtx = {
      from: { id: 998877 },
      effectiveRole: 'FIELD_ADMIN',
      callbackQuery: { id: 'cb-dir-ok' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockImplementation((text: string) => {
        if (text.includes('دليل وسجل العاملين')) {
          directoryRendered = true;
        }
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleDirectory(mockCtx);

    // Assert
    expect(directoryRendered).toBe(true);
    expect(mockCtx.reply).not.toHaveBeenCalledWith(expect.stringContaining('لا تملك الصلاحية'));
  });
});
