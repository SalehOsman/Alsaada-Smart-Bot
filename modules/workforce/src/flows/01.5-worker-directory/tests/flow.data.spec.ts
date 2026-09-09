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

  it('should display unmasked National ID to admins/super admins and masked to others', async () => {
    const rawSecret = 'test-secret-key-32-chars-long-abc!!';
    const { encryptField } = await import('@alsaada/database');
    const { createHash } = await import('node:crypto');
    const encryptionKey = createHash('sha256').update(rawSecret).digest('hex');

    const encryptedNatId = encryptField('28009010100332', encryptionKey);

    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'صالح عثمان',
      idType: 'NATIONAL_ID',
      nationalIdEncrypted: encryptedNatId,
      phoneEncrypted: null,
      jobTitle: 'إداري',
      hireDate: new Date('2026-09-01'),
      dailyWage: 800,
      status: 'ACTIVE',
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerDirectoryRepository(mockPrisma);
    const service = new WorkerDirectoryService(repo, encryptionKey);

    // SUPER_ADMIN sees full ID
    const superAdminProfile = await service.getWorkerProfile360('wrk-1', 'SUPER_ADMIN');
    expect(superAdminProfile?.idNumberMasked).toBe('28009010100332');

    // FIELD_ADMIN sees full ID
    const fieldAdminProfile = await service.getWorkerProfile360('wrk-1', 'FIELD_ADMIN');
    expect(fieldAdminProfile?.idNumberMasked).toBe('28009010100332');

    // GUEST sees masked ID
    const guestProfile = await service.getWorkerProfile360('wrk-1', 'GUEST');
    expect(guestProfile?.idNumberMasked).toBe('**********0332');
  });

  it('should include phone call button in profile360ActionsKeyboard', async () => {
    const { WorkerDirectoryKeyboards } = await import('../flow.keyboard.js');
    const kb = WorkerDirectoryKeyboards.profile360ActionsKeyboard('wrk-1', 'https://wa.me/2010', true);
    const flat = kb.inline_keyboard.flat();
    const callBtn = flat.find((b) => b.callback_data === 'action:worker:call:wrk-1');
    expect(callBtn).toBeDefined();
    expect(callBtn?.text).toContain('اتصال هاتفي مباشر');
  });
});
