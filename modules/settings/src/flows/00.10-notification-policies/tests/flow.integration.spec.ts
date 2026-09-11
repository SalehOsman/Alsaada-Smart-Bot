import { describe, it, expect, vi } from 'vitest';
import { NotificationPoliciesRepository } from '../flow.repository.js';
import { NotificationPoliciesService } from '../flow.service.js';

describe('Flow 00.10: Integration Spec', () => {
  it('integrates repository and service to retrieve policy matrices', async () => {
    const store = new Map<string, string>();
    const mockRedis = {
      get: vi.fn((k: string) => Promise.resolve(store.get(k) || null)),
      set: vi.fn((k: string, v: string) => {
        store.set(k, v);
        return Promise.resolve('OK');
      }),
      del: vi.fn((...keys: string[]) => {
        for (const k of keys) store.delete(k);
        return Promise.resolve(keys.length);
      }),
      keys: vi.fn((p: string) => {
        const prefix = p.replace('*', '');
        return Promise.resolve(Array.from(store.keys()).filter((k) => k.startsWith(prefix)));
      }),
    };

    const repo = new NotificationPoliciesRepository(mockRedis as unknown as import('ioredis').Redis);
    const service = new NotificationPoliciesService(repo);

    const summaries = await service.getScopeDepartmentSummaries('hq');
    expect(summaries.length).toBeGreaterThan(0);

    await service.toggleFeaturePolicy('hq', 'canteen:cigarettes');
    expect(store.get('notif:policy:hq:canteen:cigarettes')).toBe('false');
  });
});
