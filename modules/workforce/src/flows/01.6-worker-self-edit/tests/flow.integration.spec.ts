import { describe, it, expect, vi } from 'vitest';
import { WorkerSelfEditService } from '../flow.service.js';
import { WorkerSelfEditRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('01.6 Worker Self-Edit — Integration Tests', () => {
  it('should successfully process worker self-edit and persist via repository', async () => {
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

    const res = await service.executeSelfEdit({
      workerId: 'w-100',
      workerCode: 'OP-DRV-001',
      workerName: 'محمود أحمد',
      field: 'address',
      newValue: 'أسوان - كوم أمبو',
      reason: 'تغيير السكن',
      actorTelegramId: 998877n,
    });

    expect(res.success).toBe(true);
    expect(res.updatedField).toBe('address');
    expect(res.newValue).toBe('أسوان - كوم أمبو');
    expect(mockPrisma.worker.update).toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });
});
