import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@alsaada/database';
import type { Redis } from 'ioredis';
import { TelegramGroupsRepository } from '../flow.repository.js';
import { TelegramGroupsService } from '../flow.service.js';

describe('Flow 00.11: Integration Spec', () => {
  it('integrates repository and service to bind and unbind groups', async () => {
    const mockPrisma = {
      site: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaClient;

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
    } as unknown as Redis;

    const repo = new TelegramGroupsRepository(mockPrisma, mockRedis);
    const service = new TelegramGroupsService(repo);

    await service.bindHqGroup('-100123456');
    const status = await service.getHqGroupStatus();
    expect(status.isBound).toBe(true);
    expect(status.chatId).toBe('-100123456');

    await service.unbindHqGroup();
    const statusAfter = await service.getHqGroupStatus();
    expect(statusAfter.isBound).toBe(false);
  });
});
