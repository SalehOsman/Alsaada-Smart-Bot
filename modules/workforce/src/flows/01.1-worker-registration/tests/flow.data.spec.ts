import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { WorkerRegistrationService } from '../flow.service.js';
import { WorkerRegistrationRepository } from '../flow.repository.js';
import { encryptField, decryptField } from '@alsaada/database';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.1 Data Tests — PII Encryption, Blind Indexing & Standard Dates', () => {
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

  it('encrypts sensitive PII fields and generates blind indexes for worker registration', async () => {
    // Arrange
    const rawSecret = 'test-secret-key-32-chars-long-abc!!';
    const encryptionKey = createHash('sha256').update(rawSecret).digest('hex');
    const salt = 'test-salt-secret-value';

    let capturedPayload: {
      phoneEncrypted: string;
      phoneBlindIndex: string;
      nationalIdEncrypted: string | null;
      nationalIdBlindIndex: string | null;
    } | null = null;

    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation((args: { data: unknown }) => {
          const data = args.data as {
            phoneEncrypted: string;
            phoneBlindIndex: string;
            nationalIdEncrypted: string | null;
            nationalIdBlindIndex: string | null;
            code: string;
            name: string;
            jobTitle: string;
            hireDate: Date;
          };
          capturedPayload = {
            phoneEncrypted: data.phoneEncrypted,
            phoneBlindIndex: data.phoneBlindIndex,
            nationalIdEncrypted: data.nationalIdEncrypted,
            nationalIdBlindIndex: data.nationalIdBlindIndex,
          };
          return Promise.resolve({
            id: 'worker-1',
            ...data,
            site: { name: 'موقع الوادي' },
          });
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'outbox-1' }),
      },
      jobTitle: {
        findUnique: vi.fn().mockResolvedValue({
          code: 'DRV',
          department: { code: 'OP' },
        }),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
    } as unknown as PrismaClient;

    const repo = new WorkerRegistrationRepository(mockPrisma);
    const service = new WorkerRegistrationService(repo, undefined, encryptionKey, salt);

    const originalPhone = '01012345678';
    const originalNatId = '29001012701234';

    // Act
    await service.registerWorker({
      name: 'عبد الرحمن السيد محمود',
      idType: 'NATIONAL_ID',
      idNumber: originalNatId,
      phone: originalPhone,
      jobTitleName: 'سائق',
    });

    // Assert
    const resultPayload = capturedPayload as {
      phoneEncrypted: string;
      phoneBlindIndex: string;
      nationalIdEncrypted: string | null;
      nationalIdBlindIndex: string | null;
    } | null;
    expect(resultPayload).not.toBeNull();
    if (!resultPayload) return;

    // Verify values are not plain text
    expect(resultPayload.phoneEncrypted).not.toBe(originalPhone);
    expect(resultPayload.nationalIdEncrypted).not.toBe(originalNatId);

    // Verify blind indexes are populated
    expect(resultPayload.phoneBlindIndex).toBeDefined();
    expect(resultPayload.nationalIdBlindIndex).toBeDefined();

    // Verify decryption recovers original values
    const decryptedPhone = decryptField(resultPayload.phoneEncrypted, encryptionKey);
    expect(decryptedPhone).toBe(originalPhone);

    if (resultPayload.nationalIdEncrypted) {
      const decryptedNatId = decryptField(resultPayload.nationalIdEncrypted, encryptionKey);
      expect(decryptedNatId).toBe(originalNatId);
    }
  });

  it('rejects decryption when an incorrect tampering key is provided', () => {
    // Arrange
    const originalPhone = '01012345678';
    const rawSecret = 'test-secret-key-32-chars-long-abc!!';
    const originalKey = createHash('sha256').update(rawSecret).digest('hex');
    const wrongKey = createHash('sha256').update('wrong-secret-key-32-chars-long!!').digest('hex');

    // Act
    const encrypted = encryptField(originalPhone, originalKey);

    // Assert
    expect(encrypted).not.toBe(originalPhone);
    expect(() => decryptField(encrypted, wrongKey)).toThrow();
  });
});
