import { describe, it, expect, vi } from 'vitest';
import { WorkerOffboardingService } from '../flow.service.js';
import { WorkerOffboardingRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('01.8 Worker Offboarding — Integration Tests', () => {
  it('should offboard worker, demote linked user to GUEST, and trigger demotion callback', async () => {
    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'w-77',
          code: 'OP-HLP-0077',
          name: 'إبراهيم حسن',
          nickname: 'هيما',
          status: 'ACTIVE',
          telegramId: 44556677n,
        }),
        update: vi.fn().mockResolvedValue({ id: 'w-77' }),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'aud-1' }),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'out-1' }),
      },
      $transaction: vi.fn().mockImplementation(async (fns: unknown[]) => Promise.all(fns)),
    } as unknown as PrismaClient;

    const onWorkerDemoted = vi.fn().mockResolvedValue(undefined);
    const repo = new WorkerOffboardingRepository(mockPrisma);
    const service = new WorkerOffboardingService(repo, onWorkerDemoted);

    const res = await service.executeOffboarding({
      workerId: 'w-77',
      workerCode: 'OP-HLP-0077',
      reason: 'RESIGNATION',
      notes: 'سفر للخارج',
      actorTelegramId: 1000n,
    });

    expect(res.success).toBe(true);
    expect(res.demotedTelegramId).toBe(44556677n);
    expect(mockPrisma.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w-77' },
        data: expect.objectContaining({
          status: 'TERMINATED',
          telegramId: null,
        }),
      })
    );
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'GUEST',
          workerId: null,
          assignedSiteId: null,
        }),
      })
    );
    expect(onWorkerDemoted).toHaveBeenCalledWith(44556677n);
  });
});
