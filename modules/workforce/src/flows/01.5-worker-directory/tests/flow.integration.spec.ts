import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerDirectoryService } from '../flow.service.js';
import { WorkerDirectoryRepository } from '../flow.repository.js';
import { encryptField } from '@alsaada/database';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.5 Integration Tests — Worker Directory Repository & Filtering', () => {
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

  it('queries workers scoped by site and search term', async () => {
    // Arrange
    const mockWorkers = [
      {
        id: 'wrk-1',
        code: 'OP-DRV-001',
        legacyCode: null,
        aliases: ['أبو السيد'],
        name: 'محمود السيد أحمد',
        nickname: 'أبو السيد',
        jobTitle: 'سائق لودر',
        siteId: 'site-1',
        site: { name: 'موقع السباعية' },
        status: 'ACTIVE',
      },
    ];

    const mockPrisma = {
      worker: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue(mockWorkers),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerDirectoryRepository(mockPrisma);
    const service = new WorkerDirectoryService(repo);

    // Act
    const result = await service.getDirectoryPage({
      page: 1,
      pageSize: 10,
      searchQuery: 'محمود',
      siteId: 'site-1',
    });

    // Assert
    expect(result.totalCount).toBe(1);
    expect(result.items.length).toBe(1);
    expect(result.items[0]?.name).toBe('محمود السيد أحمد');
    expect(result.items[0]?.siteName).toBeDefined();
  });

  it('retrieves full 360 profile and decrypts encrypted phone numbers', async () => {
    // Arrange
    const rawSecret = 'test-secret-key-32-chars-long-abc!!';
    const encryptionKey = createHash('sha256').update(rawSecret).digest('hex');

    const encryptedPhone = encryptField('01012345678', encryptionKey);
    const encryptedNatId = encryptField('29001012701234', encryptionKey);

    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-DRV-001',
      name: 'محمود السيد',
      idType: 'NATIONAL_ID',
      nationalIdEncrypted: encryptedNatId,
      phoneEncrypted: encryptedPhone,
      jobTitle: 'سائق',
      hireDate: new Date('2026-09-01'),
      dailyWage: 300,
      status: 'ACTIVE',
      site: { name: 'موقع السباعية' },
      department: { name: 'التشغيل' },
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerDirectoryRepository(mockPrisma);
    const service = new WorkerDirectoryService(repo, encryptionKey);

    // Act
    const profile = await service.getWorkerProfile360('wrk-1', 'SUPER_ADMIN');

    // Assert
    expect(profile).not.toBeNull();
    expect(profile?.phone).toBe('01012345678');
    expect(profile?.idNumberMasked).toContain('1234');
    expect(profile?.directWhatsAppUrl).toContain('01012345678');
    expect(profile?.phone).not.toBe(encryptedPhone);
  });
});
