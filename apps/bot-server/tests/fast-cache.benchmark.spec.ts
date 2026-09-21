import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fastCache } from '../src/services/fast-cache.service.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

const mockRedisStore = new Map<string, string>();

vi.mock('../src/redis.js', () => ({
  redis: {
    status: 'ready',
    on: vi.fn(),
    get: vi.fn().mockImplementation((key: string) => Promise.resolve(mockRedisStore.get(key) || null)),
    set: vi.fn().mockImplementation((key: string, val: string) => {
      mockRedisStore.set(key, val);
      return Promise.resolve('OK');
    }),
    del: vi.fn().mockImplementation((...keys: string[]) => {
      keys.forEach((k) => mockRedisStore.delete(k));
      return Promise.resolve(keys.length);
    }),
    keys: vi.fn().mockImplementation((pattern: string) => {
      const prefix = pattern.replace('*', '');
      const matched = Array.from(mockRedisStore.keys()).filter((k) => k.startsWith(prefix));
      return Promise.resolve(matched);
    }),
  },
  safeRedisGet: vi.fn().mockImplementation((key: string) => Promise.resolve(mockRedisStore.get(key) || null)),
  safeRedisSet: vi.fn().mockImplementation((key: string, val: string) => {
    mockRedisStore.set(key, val);
    return Promise.resolve(true);
  }),
}));

describe('⚡ FastCache SLA & High-Performance Benchmark Suite', () => {
  beforeEach(() => {
    fastCache.clearL1();
    mockRedisStore.clear();
    vi.clearAllMocks();
  });

  it('retrieves cached payload from L1 RAM within latency SLA', async () => {
    // Arrange
    const key = 'bench:l1:user_profile';
    const payload = {
      id: 'usr-bench-100',
      telegramId: 9876543210n,
      role: 'SUPER_ADMIN',
      fullName: 'Benchmark Super Admin',
      sites: ['site-1', 'site-2'],
    };

    // Warm up the key in L1
    await fastCache.remember(key, 60, async () => payload);

    // Act
    const iterations = 500;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const val = await fastCache.get(key);
      expect(val).toBeDefined();
    }
    const totalMs = performance.now() - start;
    const avgLatencyMs = totalMs / iterations;

    // Assert
    expect(avgLatencyMs).toBeLessThan(1.0);
    expect(totalMs).toBeLessThan(1000);
  });

  it('protects against cache stampede by coalescing concurrent requests to single factory call', async () => {
    // Arrange
    const key = 'bench:stampede:expensive_report';
    let factoryCallCount = 0;

    const expensiveFactory = async () => {
      factoryCallCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { generatedAt: PINNED_BASE_TIME.getTime(), itemsCount: 500 };
    };

    // Act
    const requests = Array.from({ length: 50 }, () =>
      fastCache.remember(key, 60, expensiveFactory)
    );
    const results = await Promise.all(requests);

    // Assert
    expect(factoryCallCount).toBe(1);
    expect(results).toHaveLength(50);
    for (const res of results) {
      expect(res).toBeDefined();
      expect(res.itemsCount).toBe(500);
      expect(res.generatedAt).toBe(PINNED_BASE_TIME.getTime());
    }
  });

  it('implements SWR pattern by returning stale data immediately and revalidating asynchronously', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    const key = 'bench:swr:live_rates';
    let version = 1;

    try {
      // Act 1: Seed initial data
      const initial = await fastCache.rememberSWR(key, 1, async () => ({
        version: version++,
        timestamp: PINNED_BASE_TIME.getTime(),
      }));

      // Assert 1
      expect(initial.version).toBe(1);

      // Act 2: Read immediately (fresh hit)
      const immediate = await fastCache.rememberSWR(key, 1, async () => ({
        version: version++,
        timestamp: PINNED_BASE_TIME.getTime(),
      }));

      // Assert 2
      expect(immediate.version).toBe(1);

      // Act 3: Advance virtual clock past 1s TTL (1.1s)
      vi.setSystemTime(new Date(PINNED_BASE_TIME.getTime() + 1100));

      let bgResolve!: () => void;
      const bgPromise = new Promise<void>((resolve) => {
        bgResolve = resolve;
      });

      const t0 = performance.now();
      const staleResult = await fastCache.rememberSWR(key, 1, async () => {
        const res = { version: version++, timestamp: PINNED_BASE_TIME.getTime() };
        bgResolve();
        return res;
      });
      const elapsed = performance.now() - t0;

      // Assert 3: Stale returned immediately
      expect(elapsed).toBeLessThan(50);
      expect(staleResult.version).toBe(1);

      // Act 4: Wait for background revalidation to settle
      await bgPromise;

      const updatedResult = await fastCache.rememberSWR(key, 1, async () => ({
        version: version++,
        timestamp: PINNED_BASE_TIME.getTime(),
      }));

      // Assert 4
      expect(updatedResult.version).toBe(2);
      expect(updatedResult.version).not.toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves BigInt serialization and deserialization integrity across L1 and L2', async () => {
    // Arrange
    const key = 'bench:bigint:payload';
    const complexData = {
      telegramId: 900719925474099999n,
      hugeNumber: 123456789012345678901234567890n,
      subObject: {
        workerId: 987654321n,
      },
    };

    // Act 1
    await fastCache.remember(key, 60, async () => complexData);
    const fromL1 = await fastCache.get<typeof complexData>(key);

    // Assert 1
    expect(fromL1).toBeDefined();
    expect(typeof fromL1?.telegramId).toBe('bigint');
    expect(fromL1?.telegramId).toBe(900719925474099999n);

    // Act 2: Clear L1 to force L2 Redis retrieval
    fastCache.clearL1();
    const fromL2 = await fastCache.get<any>(key);

    // Assert 2
    expect(fromL2).toBeDefined();
    expect(fromL2?.telegramId).toBe('900719925474099999');
    expect(BigInt(fromL2?.telegramId)).toBe(900719925474099999n);
    expect(fromL2?.hugeNumber).toBe('123456789012345678901234567890');
    expect(BigInt(fromL2?.hugeNumber)).toBe(123456789012345678901234567890n);
    expect(fromL2?.subObject?.workerId).toBe('987654321');
    expect(BigInt(fromL2?.subObject?.workerId)).toBe(987654321n);
    expect(fromL2).not.toBeNull();
  });

  it('invalidates and purges keys from L1 and L2 to enforce fresh retrieval', async () => {
    // Arrange
    const key = 'bench:invalidation:target';
    let fetchCount = 0;

    const fetcher = async () => {
      fetchCount++;
      return { count: fetchCount };
    };

    // Act 1
    const first = await fastCache.remember(key, 60, fetcher);

    // Assert 1
    expect(first.count).toBe(1);

    // Act 2: Invalidate
    await fastCache.invalidate(key);
    const second = await fastCache.remember(key, 60, fetcher);

    // Assert 2
    expect(second.count).toBe(2);
    expect(fetchCount).toBe(2);
    expect(second.count).not.toBe(first.count);
  });

  it('falls back to in-memory execution in withLock when Redis is offline or reconnecting', async () => {
    // Arrange
    const { redis } = await import('../src/redis.js');
    const originalStatus = redis.status;
    (redis as any).status = 'connecting';

    let actionExecuted = false;

    // Act
    const lockResult = await fastCache.withLock('bench:offline:lock', 5, async () => {
      actionExecuted = true;
      return 'OK_OFFLINE';
    });

    // Assert
    expect(lockResult.success).toBe(true);
    expect(lockResult.result).toBe('OK_OFFLINE');
    expect(actionExecuted).toBe(true);
    expect(lockResult.result).not.toBe('FAILED');

    // Restore status
    (redis as any).status = originalStatus;
  });
});
