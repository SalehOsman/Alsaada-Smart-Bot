import { describe, it, expect, vi } from 'vitest';
import { WorkerRegistrationService } from '../flow.service.js';
import { WorkerRegistrationRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.1 Integration Tests — Atomic Worker Registration & Outbox', () => {
  it('should atomically persist worker, audit log, and outbox event upon registration', async () => {
    const createdWorkerMock = {
      id: 'worker-uuid-1',
      code: 'OP-DRV-001',
      name: 'محمود علي إبراهيم',
      nickname: 'محمود علي',
      jobTitle: 'سائق لودر',
      hireDate: new Date('2026-09-01'),
      shiftSystem: '20_WORK_10_REST',
      site: { id: 'site-1', name: 'موقع السباعية' },
    };

    let auditLogCreated = false;
    let outboxCreated = false;

    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(createdWorkerMock),
      },
      auditLog: {
        create: vi.fn().mockImplementation(() => {
          auditLogCreated = true;
          return Promise.resolve({ id: 'audit-1' });
        }),
      },
      outboxEvent: {
        create: vi.fn().mockImplementation(() => {
          outboxCreated = true;
          return Promise.resolve({ id: 'outbox-1' });
        }),
      },
      jobTitle: {
        findUnique: vi.fn().mockResolvedValue({
          code: 'DRV',
          department: { code: 'OP' },
        }),
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback(mockPrisma);
      }),
    } as unknown as PrismaClient;

    const repo = new WorkerRegistrationRepository(mockPrisma);
    const service = new WorkerRegistrationService(repo);

    const result = await service.registerWorker(
      {
        name: 'محمود علي إبراهيم',
        idType: 'NATIONAL_ID',
        idNumber: '29001012701234',
        phone: '01012345678',
        jobTitleName: 'سائق لودر',
        jobTitleId: 'job-uuid-1',
        siteName: 'موقع السباعية',
      },
      BigInt(99887766),
      'FIELD_ADMIN'
    );

    expect(result.code).toBe('OP-DRV-001');
    expect(result.name).toBe('محمود علي إبراهيم');
    expect(auditLogCreated).toBe(true);
    expect(outboxCreated).toBe(true);
  });

  it('should block duplicate registrations when an existing worker shares the same national ID', async () => {
    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'existing-id',
          code: 'OP-DRV-001',
          name: 'سعيد عبد الله',
          jobTitle: 'سائق',
          site: { name: 'الموقع القديم' },
        }),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerRegistrationRepository(mockPrisma);
    const service = new WorkerRegistrationService(repo);

    await expect(
      service.registerWorker({
        name: 'سعيد عبد الله الجديد',
        idType: 'NATIONAL_ID',
        idNumber: '29001012701234',
        phone: '01012345678',
        jobTitleName: 'سائق',
      })
    ).rejects.toThrow(/تعارض/);
  });
});
