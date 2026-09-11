import { describe, it, expect, vi } from 'vitest';
import { UserRbacService } from '../flow.service.js';
import { UserRbacRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 00.12 Integration Tests — UserRbacRepository & Service', () => {
  it('executes atomic direct link and clean transfer in repository', async () => {
    const mockWorker = {
      id: 'w-1',
      code: 'OP-001',
      name: 'محمود سعد',
      nickname: 'حودة',
      siteId: 'site-1',
      telegramId: null,
      isDeleted: false,
    };

    const mockConflictWorker = {
      id: 'w-old',
      code: 'OP-099',
      name: 'سعيد قديم',
      nickname: 'سعيد',
      siteId: 'site-1',
      telegramId: 888777666n,
      isDeleted: false,
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
        findFirst: vi.fn().mockResolvedValue(mockConflictWorker),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback(mockPrisma);
      }),
    } as unknown as PrismaClient;

    const repo = new UserRbacRepository(mockPrisma);
    const service = new UserRbacService(repo);

    // 1. Without conflict confirmation -> fails with conflict warning
    const conflictRes = await service.directLinkWorker('w-1', '888777666', { confirmConflict: false });
    expect(conflictRes.success).toBe(false);
    expect(conflictRes.reboundFromOldUser).toBe(true);

    // 2. With conflict confirmation -> succeeds and cleans old worker
    const successRes = await service.directLinkWorker('w-1', '888777666', { confirmConflict: true });
    expect(successRes.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
