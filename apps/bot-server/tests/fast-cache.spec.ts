import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    fastCache.clearL1();
    mockRedisStore.clear();
    vi.clearAllMocks();
  });

  describe('L1 In-Memory RAM & L2 Redis Hierarchy', () => {
    it('should return result from fetcher on initial miss and populate L1 cache', async () => {
      const fetcher = vi.fn().mockResolvedValue({ count: 42 });
      const res1 = await fastCache.remember('test:key:1', 60, fetcher);

      expect(res1).toEqual({ count: 42 });
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Second call must hit L1 RAM immediately without invoking fetcher
      const res2 = await fastCache.remember('test:key:1', 60, fetcher);
      expect(res2).toEqual({ count: 42 });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should fall back to L2 Redis when L1 is empty and re-prime L1', async () => {
      const fetcher = vi.fn().mockResolvedValue({ status: 'ok' });
      await fastCache.set('test:key:l2', { status: 'ok' }, 60);

      // Clear L1 to simulate cold process or evicted entry
      fastCache.clearL1();

      const res = await fastCache.remember('test:key:l2', 60, fetcher);
      expect(res).toEqual({ status: 'ok' });
      // Fetcher should not be called because L2 had the value
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should safely serialize BigInt and Date values without runtime exceptions', async () => {
      const payload = {
        telegramId: 9876543210123456789n,
        timestamp: new Date('2026-09-07T12:00:00.000Z'),
        name: 'SuperAdmin',
      };

      // Native JSON.stringify would throw TypeError on BigInt
      await expect(fastCache.set('test:bigint', payload, 60)).resolves.not.toThrow();

      fastCache.clearL1(); // Force reading through JSON serialization/deserialization

      const retrieved = await fastCache.get<any>('test:bigint');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.telegramId).toBe('9876543210123456789');
      expect(retrieved?.name).toBe('SuperAdmin');
    });

    it('should invalidate specific key from both L1 and L2', async () => {
      await fastCache.set('test:inv', { val: 1 }, 60);
      expect(await fastCache.get('test:inv')).toEqual({ val: 1 });

      await fastCache.invalidate('test:inv');
      expect(await fastCache.get('test:inv')).toBeNull();
      expect(mockRedisStore.has('fastcache:test:inv')).toBe(false);
    });

    it('should invalidate keys matching pattern from both L1 and L2', async () => {
      await fastCache.set('site:ste-01', { name: 'Site 1' }, 60);
      await fastCache.set('site:ste-02', { name: 'Site 2' }, 60);
      await fastCache.set('user:100', { name: 'User 100' }, 60);

      await fastCache.invalidatePattern('site*');

      expect(await fastCache.get('site:ste-01')).toBeNull();
      expect(await fastCache.get('site:ste-02')).toBeNull();
      expect(await fastCache.get('user:100')).toEqual({ name: 'User 100' });
    });

    it('should execute callback with distributed mutex lock', async () => {
      let executed = false;
      const result = await fastCache.withLock('lock:test', 10, async () => {
        executed = true;
        return 'DONE';
      });

      expect(executed).toBe(true);
      expect(result).toEqual({ success: true, result: 'DONE' });
    });
  });

  describe('SystemDataService Centralized Facade', () => {
    it('should retrieve sites from SystemDataService and cache in L1', async () => {
      const sites1 = await systemDataService.getSites();
      expect(sites1).toHaveLength(1);
      expect(sites1[0]?.code).toBe('STE-01');

      const sites2 = await systemDataService.getSites();
      expect(sites2).toBe(sites1); // Exact reference from L1 RAM (< 0.1ms)
    });

    it('should retrieve company profile and invalidate cleanly', async () => {
      const comp1 = await systemDataService.getCompanyProfile();
      expect(comp1?.legalName).toBe('شركة السعادة للمقاولات');

      await systemDataService.invalidateCompanyProfile();
      expect(fastCache.getMemoryKeys()).not.toContain('company_profile');
    });

    it('should retrieve dynamic company trade name reflecting the database value for any tenant', async () => {
      const name = await systemDataService.getCompanyTradeName();
      expect(name).toBe('شركة السعادة');
    });

    it('should invalidate user-related caches in bulk', async () => {
      const tid = 123456789n;
      await systemDataService.getAdminUser(tid);

      await systemDataService.invalidateUser(tid);
      expect(fastCache.getMemoryKeys()).not.toContain(`admin_profile:${tid}`);
    });

    it('should warm up all essential L1 caches during warmup()', async () => {
      await systemDataService.warmup();
      const keys = fastCache.getMemoryKeys();
      expect(keys).toContain('sites:hub:all');
      expect(keys).toContain('projects:active:list');
      expect(keys).toContain('company_profile');
    });
  });
});
