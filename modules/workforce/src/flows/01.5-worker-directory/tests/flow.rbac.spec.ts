import { describe, it, expect, vi } from 'vitest';
import { WorkerDirectoryHandler } from '../flow.handler.js';
import { WorkerDirectoryService } from '../flow.service.js';
import { WorkerDirectoryRepository } from '../flow.repository.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.5 RBAC Tests — Directory Access Control', () => {
  it('should block unauthorized roles such as GUEST and WORKER from viewing the directory', async () => {
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

      await handler.handleDirectory(mockCtx);
      expect(blockedMessage).toBe(true);
    }
  });

  it('should allow authorized roles to access the directory', async () => {
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

    await handler.handleDirectory(mockCtx);
    expect(directoryRendered).toBe(true);
  });
});
