import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerEditService } from '../flow.service.js';
import { WorkerEditRepository } from '../flow.repository.js';
import { decryptField } from '@alsaada/database';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.2.D Data Tests — Sensitive Fields Encryption & Blind Indexing on Edit', () => {
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

  it('encrypts phone field and updates blind index when editing phone number', async () => {
    // Arrange
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

    // Act
    await service.applyDirectEdit('wrk-1', 'phone', newPhone);

    // Assert
    const resultData = capturedData as { phoneEncrypted?: string; phoneBlindIndex?: string } | null;
    expect(resultData).not.toBeNull();
    if (!resultData) return;

    expect(resultData.phoneEncrypted).toBeDefined();
    expect(resultData.phoneEncrypted).not.toBe(newPhone);
    expect(resultData.phoneBlindIndex).toBeDefined();

    const decrypted = decryptField(resultData.phoneEncrypted!, encryptionKey);
    expect(decrypted).toBe(newPhone);
  });

  it('fails decryption cleanly when tampering with encrypted payload or supplying incorrect key', async () => {
    // Arrange
    const rawSecret = 'test-secret-key-32-chars-long-abc!!';
    const encryptionKey = createHash('sha256').update(rawSecret).digest('hex');
    const wrongKey = createHash('sha256').update('wrong-secret-key-tampered-value!').digest('hex');
    const salt = 'test-salt-secret-value';

    let capturedData: { phoneEncrypted?: string; phoneBlindIndex?: string } | null = null;

    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'سالم حسن',
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
        update: vi.fn().mockImplementation((args: { data: { phoneEncrypted?: string } }) => {
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

    // Act
    await service.applyDirectEdit('wrk-1', 'phone', '01099887766');

    // Assert
    expect(capturedData).not.toBeNull();
    const phoneEncrypted = (capturedData as { phoneEncrypted?: string } | null)?.phoneEncrypted;
    expect(phoneEncrypted).toBeDefined();
    expect(() => decryptField(phoneEncrypted!, wrongKey)).toThrow();
  });
});
