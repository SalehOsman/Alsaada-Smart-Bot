import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

const mockRedisStore = new Map<string, string>();

vi.mock('../src/redis.js', () => ({
  redis: {
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
    scanStream: vi.fn().mockImplementation((options: { match: string; count?: number }) => {
      const prefix = options.match.replace('*', '');
      const matched = Array.from(mockRedisStore.keys()).filter((k) => k.startsWith(prefix));
      return (async function* () {
        if (matched.length > 0) {
          yield matched;
        }
      })();
    }),
  },
}));

vi.mock('../src/db.js', () => ({
  prisma: {
    site: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'site-1', code: 'STE-01', name: 'موقع 1', status: 'ACTIVE', workers: [] },
      ]),
      findUnique: vi.fn().mockResolvedValue({
        id: 'site-1',
        code: 'STE-01',
        name: 'موقع 1',
        status: 'ACTIVE',
        workers: [],
      }),
    },
    project: {
      findMany: vi.fn().mockResolvedValue([{ id: 'prj-1', name: 'مشروع 1', status: 'ACTIVE' }]),
    },
    companyProfile: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'comp-1',
        legalName: 'شركة السعادة للمقاولات',
        tradeName: 'شركة السعادة',
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'u-1',
        telegramId: 123456789n,
        fullName: 'المدير العام',
        role: 'SUPER_ADMIN',
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { fastCache } from '../src/services/fast-cache.service.js';
import { systemDataService } from '../src/services/system-data.service.js';

describe('⚡ FastCacheService & SystemDataService Architecture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    fastCache.clearL1();
    mockRedisStore.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('L1 In-Memory RAM & L2 Redis Hierarchy', () => {
    it('returns result from fetcher on initial miss and populates L1 cache', async () => {
      // Arrange
      const fetcher = vi.fn().mockResolvedValue({ count: 42 });

      // Act
      const res1 = await fastCache.remember('test:key:1', 60, fetcher);

      // Assert
      expect(res1).toEqual({ count: 42 });
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Second call must hit L1 RAM immediately without invoking fetcher
      const res2 = await fastCache.remember('test:key:1', 60, fetcher);
      expect(res2).toEqual({ count: 42 });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('falls back to L2 Redis when L1 is empty and re-primes L1', async () => {
      // Arrange
      const fetcher = vi.fn().mockResolvedValue({ status: 'ok' });
      await fastCache.set('test:key:l2', { status: 'ok' }, 60);

      // Clear L1 to simulate cold process or evicted entry
      fastCache.clearL1();

      // Act
      const res = await fastCache.remember('test:key:l2', 60, fetcher);

      // Assert
      expect(res).toEqual({ status: 'ok' });
      expect(res).not.toBeNull();
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('safely serializes BigInt and Date values without runtime exceptions', async () => {
      // Arrange
      const payload = {
        telegramId: 9876543210123456789n,
        timestamp: new Date('2026-09-07T12:00:00.000Z'),
        name: 'SuperAdmin',
      };

      // Act
      await expect(fastCache.set('test:bigint', payload, 60)).resolves.not.toThrow();

      fastCache.clearL1();
      const retrieved = await fastCache.get<any>('test:bigint');

      // Assert
      expect(retrieved).not.toBeNull();
      expect(retrieved?.telegramId).toBe('9876543210123456789');
      expect(retrieved?.name).toBe('SuperAdmin');
      expect(retrieved).not.toBeUndefined();
    });

    it('invalidates specific key from both L1 and L2', async () => {
      // Arrange
      await fastCache.set('test:inv', { val: 1 }, 60);
      expect(await fastCache.get('test:inv')).toEqual({ val: 1 });

      // Act
      await fastCache.invalidate('test:inv');

      // Assert
      expect(await fastCache.get('test:inv')).toBeNull();
      expect(mockRedisStore.has('fastcache:test:inv')).toBe(false);
    });

    it('invalidates keys matching pattern from both L1 and L2 using non-blocking scanStream', async () => {
      // Arrange
      await fastCache.set('site:ste-01', { name: 'Site 1' }, 60);
      await fastCache.set('site:ste-02', { name: 'Site 2' }, 60);
      await fastCache.set('user:100', { name: 'User 100' }, 60);

      // Act
      await fastCache.invalidatePattern('site*');

      // Assert
      expect(await fastCache.get('site:ste-01')).toBeNull();
      expect(await fastCache.get('site:ste-02')).toBeNull();
      expect(await fastCache.get('user:100')).toEqual({ name: 'User 100' });
      expect(await fastCache.get('user:100')).not.toBeNull();
    });

    it('manages L1 capacity and touches items for LRU freshness', async () => {
      // Arrange
      await fastCache.set('lru:item:1', 'val1', 60);
      await fastCache.set('lru:item:2', 'val2', 60);

      // Act
      const val1 = await fastCache.get('lru:item:1');

      // Assert
      expect(val1).toBe('val1');
      const memKeys = fastCache.getMemoryKeys();
      expect(memKeys).toContain('lru:item:1');
      expect(memKeys).toContain('lru:item:2');
      expect(memKeys[memKeys.length - 1]).toBe('lru:item:1');
    });

    it('executes callback with distributed mutex lock', async () => {
      // Arrange
      let executed = false;

      // Act
      const result = await fastCache.withLock('lock:test', 10, async () => {
        executed = true;
        return 'DONE';
      });

      // Assert
      expect(executed).toBe(true);
      expect(result).toEqual({ success: true, result: 'DONE' });
      expect(result.success).toBe(true);
    });
  });

  describe('SystemDataService Centralized Facade', () => {
    it('retrieves sites from SystemDataService and caches in L1', async () => {
      // Arrange & Act
      const sites1 = await systemDataService.getSites();

      // Assert
      expect(sites1).toHaveLength(1);
      expect(sites1[0]?.code).toBe('STE-01');

      const sites2 = await systemDataService.getSites();
      expect(sites2).toBe(sites1);
    });

    it('retrieves company profile and invalidates cleanly', async () => {
      // Arrange
      const comp1 = await systemDataService.getCompanyProfile();

      // Act
      await systemDataService.invalidateCompanyProfile();

      // Assert
      expect(comp1?.legalName).toBe('شركة السعادة للمقاولات');
      expect(fastCache.getMemoryKeys()).not.toContain('company_profile');
    });

    it('retrieves dynamic company trade name reflecting database value for tenant', async () => {
      // Arrange & Act
      const name = await systemDataService.getCompanyTradeName();

      // Assert
      expect(name).toBe('شركة السعادة');
      expect(name).not.toBe('');
      expect(typeof name).toBe('string');
    });

    it('invalidates user-related caches in bulk', async () => {
      // Arrange
      const tid = 123456789n;
      await systemDataService.getAdminUser(tid);

      // Act
      await systemDataService.invalidateUser(tid);

      // Assert
      expect(fastCache.getMemoryKeys()).not.toContain(`admin_profile:${tid}`);
      expect(fastCache.getMemoryKeys().some((k) => k.includes(String(tid)))).toBe(false);
    });

    it('warms up all essential L1 caches during warmup()', async () => {
      // Arrange
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      try {
        await systemDataService.warmup();
        const keys = fastCache.getMemoryKeys();

        // Assert
        expect(keys).toContain('sites:hub:all');
        expect(keys).toContain('projects:active:list');
        expect(keys).toContain('company_profile');
      } finally {
        consoleLogSpy.mockRestore();
      }
    });
  });
});
