import { describe, it, expect, vi } from 'vitest';
import { WorkerEditService } from '../flow.service.js';
import { WorkerEditRepository } from '../flow.repository.js';
import { decryptField } from '@alsaada/database';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.2.D Data Tests — Sensitive Fields Encryption & Blind Indexing on Edit', () => {
  it('should encrypt phone field and update blind index when editing phone number', async () => {
    const rawSecret = 'test-secret-key-32-chars-long-abc!!';
    const encryptionKey = createHash('sha256').update(rawSecret).digest('hex');
    const salt = 'test-salt-secret-value';

    let capturedData: { phoneEncrypted?: string; phoneBlindIndex?: string } | null = null;

    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'سالم حسن',
      phoneEncrypted: null,
      phoneBlindIndex: null,
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
        update: vi.fn().mockImplementation((args: { data: { phoneEncrypted?: string; phoneBlindIndex?: string } }) => {
          capturedData = args.data;
          return Promise.resolve({ ...mockWorker, ...args.data });
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
    } as unknown as PrismaClient;

    const repo = new WorkerEditRepository(mockPrisma);
    const service = new WorkerEditService(repo, encryptionKey, salt);

    const newPhone = '01122334455';
    await service.applyDirectEdit('wrk-1', 'phone', newPhone);

    const resultData = capturedData as { phoneEncrypted?: string; phoneBlindIndex?: string } | null;
    expect(resultData).not.toBeNull();
    if (!resultData) return;

    expect(resultData.phoneEncrypted).toBeDefined();
    expect(resultData.phoneEncrypted).not.toBe(newPhone);
    expect(resultData.phoneBlindIndex).toBeDefined();

    const decrypted = decryptField(resultData.phoneEncrypted!, encryptionKey);
    expect(decrypted).toBe(newPhone);
  });
});
