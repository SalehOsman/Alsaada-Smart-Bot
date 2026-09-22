import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerSelfEditService } from '../flow.service.js';
import { WorkerSelfEditRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('01.6 Worker Self-Edit — Integration Tests', () => {
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

  it('processes worker self-edit and persists via repository successfully', async () => {
    // Arrange
    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'w-100',
          code: 'OP-DRV-001',
          name: 'محمود أحمد',
          phoneEncrypted: '01011111111',
        }),
        update: vi.fn().mockResolvedValue({ id: 'w-100' }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'aud-1' }),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'out-1' }),
      },
      $transaction: vi.fn().mockImplementation(async (fns: unknown[]) => Promise.all(fns)),
    } as unknown as PrismaClient;

    const repo = new WorkerSelfEditRepository(mockPrisma);
    const service = new WorkerSelfEditService(repo);

    // Act
    const res = await service.executeSelfEdit({
      workerId: 'w-100',
      workerCode: 'OP-DRV-001',
      workerName: 'محمود أحمد',
      field: 'address',
      newValue: 'أسوان - كوم أمبو',
      reason: 'تغيير السكن',
      actorTelegramId: 998877n,
    });

    // Assert
    expect(res.success).toBe(true);
    expect(res.updatedField).toBe('address');
    expect(res.newValue).toBe('أسوان - كوم أمبو');
    expect(mockPrisma.worker.update).toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    expect(res.updatedField).not.toBe('dailyWage');
  });
});
