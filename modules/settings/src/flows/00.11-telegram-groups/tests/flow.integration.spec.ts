import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@alsaada/database';
import type { Redis } from 'ioredis';
import { TelegramGroupsRepository } from '../flow.repository.js';
import { TelegramGroupsService } from '../flow.service.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.11 Integration Spec — مجموعات تليجرام', () => {
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

  it('integrates repository and service to bind and unbind groups', async () => {
    // Arrange
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

    // Act
    await service.bindHqGroup('-100123456');
    const status = await service.getHqGroupStatus();
    await service.unbindHqGroup();
    const statusAfter = await service.getHqGroupStatus();

    // Assert
    expect(status.isBound).toBe(true);
    expect(status.chatId).toBe('-100123456');
    expect(statusAfter.isBound).toBe(false);
    expect(statusAfter.chatId).toBeNull();
  });

  it('rejects binding malformed chat ID and leaves group unbound', async () => {
    // Arrange
    const mockPrisma = {} as unknown as PrismaClient;
    const mockRedis = {
      get: vi.fn((k: string) => Promise.resolve(null)),
      set: vi.fn(),
      del: vi.fn(),
    } as unknown as Redis;
    const repo = new TelegramGroupsRepository(mockPrisma, mockRedis);
    const service = new TelegramGroupsService(repo);

    // Act
    const bindPromise = service.bindHqGroup('malformed-chat');

    // Assert
    await expect(bindPromise).rejects.toThrow();
    expect(mockRedis.set).not.toHaveBeenCalled();
  });
});
