import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerEditDraftStore, type MinimalRedisDraftClient } from '../flow.draft-store.js';
import type { PendingWorkerEditState } from '../flow.types.js';

describe('⚡ Flow 01.2.D — WorkerEditDraftStore Composite Redis Drafts', () => {
  const redisStore = new Map<string, string>();
  let mockRedis: MinimalRedisDraftClient;
  let draftStore: WorkerEditDraftStore;

  const sampleState: PendingWorkerEditState = {
    workerId: 'w-123',
    workerCode: 'WRK-001',
    workerName: 'علي حسن',
    fieldKey: 'dailyWage',
    fieldName: 'الأجر اليومي',
    oldValue: '250',
    newValue: '300',
    isSuperAdmin: true,
  };

  beforeEach(() => {
    redisStore.clear();
    mockRedis = {
      get: vi.fn().mockImplementation(async (k: string) => redisStore.get(k) || null),
      set: vi.fn().mockImplementation(async (k: string, v: string) => {
        redisStore.set(k, v);
        return 'OK';
      }),
      del: vi.fn().mockImplementation(async (...keys: string[]) => {
        keys.forEach((k) => redisStore.delete(k));
        return keys.length;
      }),
    };
    draftStore = new WorkerEditDraftStore(mockRedis);
  });

  it('should store draft with composite key and active pointer in Redis with 1800s TTL', async () => {
    const adminId = '112233';
    draftStore.set(adminId, sampleState);

    // Synchronous memory check
    expect(draftStore.has(adminId)).toBe(true);
    expect(draftStore.get(adminId)).toEqual(sampleState);

    // Redis calls check
    expect(mockRedis.set).toHaveBeenCalledWith(
      'draft:worker_edit:112233:w-123',
      JSON.stringify(sampleState),
      'EX',
      1800
    );
    expect(mockRedis.set).toHaveBeenCalledWith(
      'draft:worker_edit:active:112233',
      'w-123',
      'EX',
      1800
    );
  });

  it('should retrieve draft from Redis if memory cache is cold', async () => {
    const adminId = '998877';
    redisStore.set('draft:worker_edit:active:998877', 'w-123');
    redisStore.set('draft:worker_edit:998877:w-123', JSON.stringify(sampleState));

    // Fresh store without memory state
    const freshStore = new WorkerEditDraftStore(mockRedis);
    expect(freshStore.get(adminId)).toBeUndefined();

    const retrieved = await freshStore.getAsync(adminId);
    expect(retrieved).toEqual(sampleState);
    // Should now be mirrored in memory
    expect(freshStore.get(adminId)).toEqual(sampleState);
  });

  it('should delete draft from memory and clean composite key and pointer from Redis', async () => {
    const adminId = '445566';
    draftStore.set(adminId, sampleState);
    expect(draftStore.has(adminId)).toBe(true);

    const deleted = draftStore.delete(adminId);
    expect(deleted).toBe(true);
    expect(draftStore.has(adminId)).toBe(false);

    expect(mockRedis.del).toHaveBeenCalledWith(
      'draft:worker_edit:active:445566',
      'draft:worker_edit:445566:w-123'
    );
  });

  it('should gracefully handle Redis errors and remain functional via memory fallback', async () => {
    const failingRedis: MinimalRedisDraftClient = {
      get: vi.fn().mockRejectedValue(new Error('Redis connection timed out')),
      set: vi.fn().mockRejectedValue(new Error('Redis write failed')),
      del: vi.fn().mockRejectedValue(new Error('Redis del failed')),
    };

    const resilientStore = new WorkerEditDraftStore(failingRedis);
    const adminId = '778899';

    // Set should not throw
    expect(() => resilientStore.set(adminId, sampleState)).not.toThrow();
    expect(resilientStore.has(adminId)).toBe(true);
    expect(resilientStore.get(adminId)).toEqual(sampleState);

    // Delete should not throw
    expect(() => resilientStore.delete(adminId)).not.toThrow();
    expect(resilientStore.has(adminId)).toBe(false);
  });
});
