import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerSelfEditRepository } from '../flow.repository.js';
import { WorkerSelfEditService } from '../flow.service.js';
import type { PrismaClient } from '@alsaada/database';

describe('01.6 Worker Self-Edit — Data Integrity Tests', () => {
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

  it('creates audit log and outbox event atomically during field update', async () => {
    // Arrange
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

    // Act
    const res = await repo.updateWorkerField({
      workerId: 'w-1',
      workerCode: 'OP-01',
      workerName: 'Ali',
      field: 'walletType',
      newValue: 'فودافون كاش',
      reason: 'تحديث المحفظة',
      actorTelegramId: 554433n,
    });

    // Assert
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
    expect(res.success).toBe(true);
  });

  it('encrypts phone and computes blind index during phone update in service', async () => {
    // Arrange
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

    // Act
    const res = await service.executeSelfEdit({
      workerId: 'w-1',
      workerCode: 'OP-01',
      workerName: 'Ali',
      field: 'phone',
      newValue: '01012345678',
      actorTelegramId: 554433n,
    });

    // Assert
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
    expect(mockPrisma.worker.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phoneEncrypted: '01012345678',
        }),
      })
    );
  });

  it('encrypts accountNumber into accountNumberEncrypted column', async () => {
    // Arrange
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

    // Act
    const res = await service.executeSelfEdit({
      workerId: 'w-1',
      workerCode: 'OP-01',
      workerName: 'Ali',
      field: 'accountNumber',
      newValue: '12345678901234',
      actorTelegramId: 554433n,
    });

    // Assert
    expect(res.success).toBe(true);
    expect(mockPrisma.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w-1' },
        data: expect.objectContaining({
          accountNumberEncrypted: expect.stringMatching(/.+/),
        }),
      })
    );
    expect(mockPrisma.worker.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountNumberEncrypted: '12345678901234',
        }),
      })
    );
  });
});
