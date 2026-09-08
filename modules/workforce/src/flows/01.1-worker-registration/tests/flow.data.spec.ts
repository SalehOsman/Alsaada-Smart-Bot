import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { WorkerRegistrationService } from '../flow.service.js';
import { WorkerRegistrationRepository } from '../flow.repository.js';
import { decryptField } from '@alsaada/database';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.1 Data Tests — PII Encryption, Blind Indexing & Standard Dates', () => {
  it('should encrypt sensitive PII fields and generate blind indexes', async () => {
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

    await service.registerWorker({
      name: 'عبد الرحمن السيد محمود',
      idType: 'NATIONAL_ID',
      idNumber: originalNatId,
      phone: originalPhone,
      jobTitleName: 'سائق',
    });

    expect(capturedPayload).not.toBeNull();
    if (!capturedPayload) return;

    // Verify values are not plain text
    expect(capturedPayload.phoneEncrypted).not.toBe(originalPhone);
    expect(capturedPayload.nationalIdEncrypted).not.toBe(originalNatId);

    // Verify blind indexes are populated
    expect(capturedPayload.phoneBlindIndex).toBeDefined();
    expect(capturedPayload.nationalIdBlindIndex).toBeDefined();

    // Verify decryption recovers original values
    const decryptedPhone = decryptField(capturedPayload.phoneEncrypted, encryptionKey);
    expect(decryptedPhone).toBe(originalPhone);

    if (capturedPayload.nationalIdEncrypted) {
      const decryptedNatId = decryptField(capturedPayload.nationalIdEncrypted, encryptionKey);
      expect(decryptedNatId).toBe(originalNatId);
    }
  });
});
