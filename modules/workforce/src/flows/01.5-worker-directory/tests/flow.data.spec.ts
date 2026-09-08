import { describe, it, expect, vi } from 'vitest';
import { WorkerDirectoryService } from '../flow.service.js';
import { WorkerDirectoryRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.5 Data Tests — Financial Masking & PII Protection', () => {
  it('should mask sensitive wage information from non-super-admin viewers', async () => {
    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'سالم حسن',
      idType: 'NATIONAL_ID',
      nationalIdEncrypted: null,
      phoneEncrypted: null,
      jobTitle: 'عامل',
      hireDate: new Date('2026-09-01'),
      dailyWage: 450,
      status: 'ACTIVE',
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerDirectoryRepository(mockPrisma);
    const service = new WorkerDirectoryService(repo);

    // FIELD_ADMIN should have wage masked
    const fieldAdminProfile = await service.getWorkerProfile360('wrk-1', 'FIELD_ADMIN');
    expect(fieldAdminProfile?.dailyWageMasked).toContain('محجوب');

    // SUPER_ADMIN should see full wage
    const superAdminProfile = await service.getWorkerProfile360('wrk-1', 'SUPER_ADMIN');
    expect(superAdminProfile?.dailyWageMasked).toContain('450');
  });
});
