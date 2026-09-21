import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationPoliciesRepository } from '../flow.repository.js';
import { NotificationPoliciesService } from '../flow.service.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.10 Integration Spec — سياسات الإشعارات', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('integrates repository and service to retrieve policy matrices', async () => {
    // Arrange
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

    // Act
    const summaries = await service.getScopeDepartmentSummaries('hq');
    await service.toggleFeaturePolicy('hq', 'canteen:cigarettes');

    // Assert
    expect(summaries.length).toBeGreaterThan(0);
    expect(store.get('notif:policy:hq:canteen:cigarettes')).toBe('false');
    expect(mockRedis.set).toHaveBeenCalled();
    expect(store.get('notif:policy:unknown:custom')).toBeUndefined();
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it('resets scope overrides to catalog defaults clearing Redis keys', async () => {
    // Arrange
    const store = new Map<string, string>();
    store.set('notif:policy:site:canteen:cigarettes', 'true');
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

    // Act
    await service.resetScopeToDefaults('site');

    // Assert
    expect(store.get('notif:policy:site:canteen:cigarettes')).toBeUndefined();
    expect(mockRedis.del).toHaveBeenCalled();
    expect(store.has('notif:policy:site:canteen:cigarettes')).toBe(false);
  });
});
