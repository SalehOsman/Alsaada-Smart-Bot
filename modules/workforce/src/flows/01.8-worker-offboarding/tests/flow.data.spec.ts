import { describe, it, expect, vi } from 'vitest';
import { WorkerOffboardingRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('01.8 Worker Offboarding — Data Integrity Tests', () => {
  it('should atomically update worker status, demote user, and emit outbox event', async () => {
    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'w-10',
          code: 'OP-010',
          name: 'سمير خليل',
          status: 'ACTIVE',
          telegramId: 99887766n,
        }),
        update: vi.fn().mockResolvedValue({ id: 'w-10' }),
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

    const repo = new WorkerOffboardingRepository(mockPrisma);

    const res = await repo.terminateWorker({
      workerId: 'w-10',
      workerCode: 'OP-010',
      reason: 'CONTRACT_END',
      notes: 'انتهاء مدة العقد',
      actorTelegramId: 500n,
    });

    expect(res.success).toBe(true);
    expect(res.demotedTelegramId).toBe(99887766n);

    expect(mockPrisma.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w-10' },
        data: expect.objectContaining({
          status: 'TERMINATED',
          telegramId: null,
        }),
      })
    );

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { telegramId: 99887766n },
            { workerId: 'w-10' },
          ],
        }),
        data: expect.objectContaining({
          role: 'GUEST',
          workerId: null,
          assignedSiteId: null,
        }),
      })
    );

    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'WORKER_OFFBOARDED_COMMITTED',
        }),
      })
    );
  });

  it('should find linked user telegramId even when worker.telegramId is null', async () => {
    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'w-20',
          code: 'OP-020',
          name: 'أيمن عادل',
          status: 'ACTIVE',
          telegramId: null,
        }),
        update: vi.fn().mockResolvedValue({ id: 'w-20' }),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'u-20', telegramId: 11223344n }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'aud-2' }) },
      outboxEvent: { create: vi.fn().mockResolvedValue({ id: 'out-2' }) },
      $transaction: vi.fn().mockImplementation(async (fns: unknown[]) => Promise.all(fns)),
    } as unknown as PrismaClient;

    const repo = new WorkerOffboardingRepository(mockPrisma);

    const res = await repo.terminateWorker({
      workerId: 'w-20',
      workerCode: 'OP-020',
      reason: 'RESIGNATION',
      actorTelegramId: 500n,
    });

    expect(res.success).toBe(true);
    expect(res.demotedTelegramId).toBe(11223344n);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { workerId: 'w-20' },
      select: { telegramId: true },
    });
  });
});
