import { describe, it, expect, vi } from 'vitest';
import { WorkerSelfEditRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('01.6 Worker Self-Edit — Data Integrity Tests', () => {
  it('should create audit log and outbox event atomically during field update', async () => {
    const mockPrisma = {
      worker: {
        update: vi.fn().mockResolvedValue({ id: 'w-1' }),
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

    const res = await repo.updateWorkerField({
      workerId: 'w-1',
      workerCode: 'OP-01',
      workerName: 'Ali',
      field: 'walletType',
      newValue: 'فودافون كاش',
      reason: 'تحديث المحفظة',
      actorTelegramId: 554433n,
    });

    expect(res.success).toBe(true);
    expect(mockPrisma.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w-1' },
        data: { walletType: 'فودافون كاش' },
      })
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'WORKER_SELF_EDIT',
          actorTelegramId: 554433n,
          entityType: 'Worker',
        }),
      })
    );
    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'WORKER_SELF_EDIT_COMMITTED',
        }),
      })
    );
  });

  it('should encrypt phone and compute blind index during phone update in service', async () => {
    const { WorkerSelfEditService } = await import('../flow.service.js');
    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue({ id: 'w-1', code: 'OP-01' }),
        update: vi.fn().mockResolvedValue({ id: 'w-1' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'aud-1' }) },
      outboxEvent: { create: vi.fn().mockResolvedValue({ id: 'out-1' }) },
      $transaction: vi.fn().mockImplementation(async (fns: unknown[]) => Promise.all(fns)),
    } as unknown as PrismaClient;

    const repo = new WorkerSelfEditRepository(mockPrisma);
    const service = new WorkerSelfEditService(repo, 'test-encryption-key-32-chars!!');

    const res = await service.executeSelfEdit({
      workerId: 'w-1',
      workerCode: 'OP-01',
      workerName: 'Ali',
      field: 'phone',
      newValue: '01012345678',
      actorTelegramId: 554433n,
    });

    expect(res.success).toBe(true);
    expect(mockPrisma.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w-1' },
        data: expect.objectContaining({
          phoneEncrypted: expect.stringMatching(/.+/),
          phoneBlindIndex: expect.stringMatching(/.+/),
        }),
      })
    );
  });

  it('should encrypt accountNumber into accountNumberEncrypted column', async () => {
    const { WorkerSelfEditService } = await import('../flow.service.js');
    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue({ id: 'w-1', code: 'OP-01' }),
        update: vi.fn().mockResolvedValue({ id: 'w-1' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'aud-1' }) },
      outboxEvent: { create: vi.fn().mockResolvedValue({ id: 'out-1' }) },
      $transaction: vi.fn().mockImplementation(async (fns: unknown[]) => Promise.all(fns)),
    } as unknown as PrismaClient;

    const repo = new WorkerSelfEditRepository(mockPrisma);
    const service = new WorkerSelfEditService(repo, 'test-encryption-key-32-chars!!');

    const res = await service.executeSelfEdit({
      workerId: 'w-1',
      workerCode: 'OP-01',
      workerName: 'Ali',
      field: 'accountNumber',
      newValue: '12345678901234',
      actorTelegramId: 554433n,
    });

    expect(res.success).toBe(true);
    expect(mockPrisma.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w-1' },
        data: expect.objectContaining({
          accountNumberEncrypted: expect.stringMatching(/.+/),
        }),
      })
    );
  });
});
