import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerOffboardingService } from '../flow.service.js';
import { WorkerOffboardingRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('01.8 Worker Offboarding — Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('offboards worker, demotes linked user to GUEST, and triggers demotion callback', async () => {
    // Arrange
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

    // Act
    const res = await service.executeOffboarding({
      workerId: 'w-77',
      workerCode: 'OP-HLP-0077',
      reason: 'RESIGNATION',
      notes: 'سفر للخارج',
      actorTelegramId: 1000n,
    });

    // Assert
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

  it('does not trigger demotion callback when worker has no linked telegram account', async () => {
    // Arrange
    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'w-88',
          code: 'OP-HLP-0088',
          name: 'خالد توفيق',
          status: 'ACTIVE',
          telegramId: null,
        }),
        update: vi.fn().mockResolvedValue({ id: 'w-88' }),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'aud-2' }) },
      outboxEvent: { create: vi.fn().mockResolvedValue({ id: 'out-2' }) },
      $transaction: vi.fn().mockImplementation(async (fns: unknown[]) => Promise.all(fns)),
    } as unknown as PrismaClient;

    const onWorkerDemoted = vi.fn().mockResolvedValue(undefined);
    const repo = new WorkerOffboardingRepository(mockPrisma);
    const service = new WorkerOffboardingService(repo, onWorkerDemoted);

    // Act
    const res = await service.executeOffboarding({
      workerId: 'w-88',
      workerCode: 'OP-HLP-0088',
      reason: 'CONTRACT_END',
      actorTelegramId: 1000n,
    });

    // Assert
    expect(res.success).toBe(true);
    expect(res.demotedTelegramId).toBeNull();
    expect(onWorkerDemoted).not.toHaveBeenCalled();
  });
});
