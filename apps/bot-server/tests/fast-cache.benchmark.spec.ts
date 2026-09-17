import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fastCache } from '../src/services/fast-cache.service.js';

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

  it('1. L1 RAM retrieval latency SLA: < 0.5ms per read (1,000 iterations)', async () => {
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

    // Run 1,000 reads from L1 RAM
    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const val = await fastCache.get(key);
      expect(val).toBeDefined();
    }
    const totalMs = performance.now() - start;
    const avgLatencyMs = totalMs / iterations;

    // Strict SLA: L1 RAM read latency must be < 0.5ms (typically < 0.05ms)
    expect(avgLatencyMs).toBeLessThan(0.5);
  });

  it('2. Dogpile / Cache Stampede Protection: 100 concurrent requests execute factory exactly ONCE', async () => {
    const key = 'bench:stampede:expensive_report';
    let factoryCallCount = 0;

    const expensiveFactory = async () => {
      factoryCallCount++;
      // Simulate asynchronous heavy computation or DB query (10ms)
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { generatedAt: Date.now(), itemsCount: 500 };
    };

    // Launch 100 concurrent requests simultaneously
    const requests = Array.from({ length: 100 }, () =>
      fastCache.remember(key, 60, expensiveFactory)
    );

    const results = await Promise.all(requests);

    // Factory must be invoked exactly once due to in-flight coalescing / lock
    expect(factoryCallCount).toBe(1);

    // All 100 callers receive identical valid payload
    for (const res of results) {
      expect(res).toBeDefined();
      expect(res.itemsCount).toBe(500);
    }
  });

  it('3. SWR (Stale-While-Revalidate) Pattern: returns stale data immediately and revalidates in background', async () => {
    const key = 'bench:swr:live_rates';
    let version = 1;

    // Seed initial data with a very short TTL (1 second)
    const initial = await fastCache.rememberSWR(key, 1, async () => ({
      version: version++,
      timestamp: Date.now(),
    }));
    expect(initial.version).toBe(1);

    // Read immediately (fresh cache hit)
    const immediate = await fastCache.rememberSWR(key, 1, async () => ({
      version: version++,
      timestamp: Date.now(),
    }));
    expect(immediate.version).toBe(1);

    // Wait for TTL to expire (1.1s)
    await new Promise((r) => setTimeout(r, 1100));

    // SWR hit: must return stale version 1 immediately without waiting for revalidation
    const t0 = performance.now();
    const staleResult = await fastCache.rememberSWR(key, 1, async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { version: version++, timestamp: Date.now() };
    });
    const elapsed = performance.now() - t0;

    // SWR returns instantly (< 5ms), serving the stale data
    expect(elapsed).toBeLessThan(10);
    expect(staleResult.version).toBe(1);

    // Wait for background revalidation to settle
    await new Promise((r) => setTimeout(r, 100));

    // Subsequent read gets the refreshed version
    const updatedResult = await fastCache.rememberSWR(key, 1, async () => ({
      version: version++,
      timestamp: Date.now(),
    }));
    expect(updatedResult.version).toBe(2);
  });

  it('4. BigInt serialization and deserialization integrity across L1 and L2', async () => {
    const key = 'bench:bigint:payload';
    const complexData = {
      telegramId: 900719925474099999n,
      hugeNumber: 123456789012345678901234567890n,
      subObject: {
        workerId: 987654321n,
      },
    };

    await fastCache.remember(key, 60, async () => complexData);

    // 1. Verify retrieval from L1 RAM (preserves exact in-memory BigInt literals)
    const fromL1 = await fastCache.get<typeof complexData>(key);
    expect(fromL1).toBeDefined();
    expect(typeof fromL1?.telegramId).toBe('bigint');
    expect(fromL1?.telegramId).toBe(900719925474099999n);

    // 2. Clear L1 RAM to force true L2 Redis retrieval through JSON serialization/deserialization
    fastCache.clearL1();

    const fromL2 = await fastCache.get<any>(key);
    expect(fromL2).toBeDefined();
    // In L2 JSON storage, BigInts are safely serialized to strings to prevent TypeError
    expect(fromL2?.telegramId).toBe('900719925474099999');
    expect(BigInt(fromL2?.telegramId)).toBe(900719925474099999n);
    expect(fromL2?.hugeNumber).toBe('123456789012345678901234567890');
    expect(BigInt(fromL2?.hugeNumber)).toBe(123456789012345678901234567890n);
    expect(fromL2?.subObject?.workerId).toBe('987654321');
    expect(BigInt(fromL2?.subObject?.workerId)).toBe(987654321n);
  });

  it('5. Invalidation SLA: purges key from L1 and L2, forcing fresh retrieval', async () => {
    const key = 'bench:invalidation:target';
    let fetchCount = 0;

    const fetcher = async () => {
      fetchCount++;
      return { count: fetchCount };
    };

    const first = await fastCache.remember(key, 60, fetcher);
    expect(first.count).toBe(1);

    // Invalidate
    await fastCache.invalidate(key);

    // Next call must invoke fetcher again
    const second = await fastCache.remember(key, 60, fetcher);
    expect(second.count).toBe(2);
    expect(fetchCount).toBe(2);
  });

  it('6. withLock fallback to in-memory execution when Redis is unavailable or reconnecting', async () => {
    const { redis } = await import('../src/redis.js');
    const originalStatus = redis.status;
    (redis as any).status = 'connecting';

    let actionExecuted = false;
    const lockResult = await fastCache.withLock('bench:offline:lock', 5, async () => {
      actionExecuted = true;
      return 'OK_OFFLINE';
    });

    expect(lockResult.success).toBe(true);
    expect(lockResult.result).toBe('OK_OFFLINE');
    expect(actionExecuted).toBe(true);

    // Restore status
    (redis as any).status = originalStatus;
  });
});
