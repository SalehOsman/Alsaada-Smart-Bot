import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerEditDraftStore, type MinimalRedisDraftClient } from '../flow.draft-store.js';
import type { PendingWorkerEditState } from '../flow.types.js';

describe('Flow 01.2.D — WorkerEditDraftStore Composite Redis Drafts', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

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

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('stores draft with composite key and active pointer in Redis with 1800s TTL', async () => {
    // Arrange
    const adminId = '112233';

    // Act
    draftStore.set(adminId, sampleState);

    // Assert
    expect(draftStore.has(adminId)).toBe(true);
    expect(draftStore.get(adminId)).toEqual(sampleState);

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

  it('retrieves draft from Redis if memory cache is cold', async () => {
    // Arrange
    const adminId = '998877';
    redisStore.set('draft:worker_edit:active:998877', 'w-123');
    redisStore.set('draft:worker_edit:998877:w-123', JSON.stringify(sampleState));

    const freshStore = new WorkerEditDraftStore(mockRedis);

    // Act
    const initialMem = freshStore.get(adminId);
    const retrieved = await freshStore.getAsync(adminId);
    const cachedMem = freshStore.get(adminId);

    // Assert
    expect(initialMem).toBeUndefined();
    expect(retrieved).toEqual(sampleState);
    expect(cachedMem).toEqual(sampleState);
  });

  it('deletes draft from memory and cleans composite key and pointer from Redis', async () => {
    // Arrange
    const adminId = '445566';
    draftStore.set(adminId, sampleState);

    // Act
    const wasPresent = draftStore.has(adminId);
    const deleted = draftStore.delete(adminId);
    const isPresentAfter = draftStore.has(adminId);

    // Assert
    expect(wasPresent).toBe(true);
    expect(deleted).toBe(true);
    expect(isPresentAfter).toBe(false);

    expect(mockRedis.del).toHaveBeenCalledWith(
      'draft:worker_edit:active:445566',
      'draft:worker_edit:445566:w-123'
    );
  });

  it('gracefully handles Redis errors and remains functional via memory fallback', async () => {
    // Arrange
    const failingRedis: MinimalRedisDraftClient = {
      get: vi.fn().mockRejectedValue(new Error('Redis connection timed out')),
      set: vi.fn().mockRejectedValue(new Error('Redis write failed')),
      del: vi.fn().mockRejectedValue(new Error('Redis del failed')),
    };

    const resilientStore = new WorkerEditDraftStore(failingRedis);
    const adminId = '778899';

    // Act
    resilientStore.set(adminId, sampleState);
    const hasBefore = resilientStore.has(adminId);
    const storedState = resilientStore.get(adminId);

    const deleted = resilientStore.delete(adminId);
    const hasAfter = resilientStore.has(adminId);

    // Assert
    expect(hasBefore).toBe(true);
    expect(storedState).toEqual(sampleState);
    expect(deleted).toBe(true);
    expect(hasAfter).toBe(false);
  });

  it('returns null when querying cold storage for nonexistent draft key', async () => {
    // Arrange
    const nonExistentId = '999999';

    // Act
    const result = await draftStore.getAsync(nonExistentId);

    // Assert
    expect(result).toBeUndefined();
    expect(draftStore.has(nonExistentId)).toBe(false);
  });
});
