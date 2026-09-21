import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserRbacService } from '../flow.service.js';
import { UserRbacRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.12 Integration Tests — UserRbacRepository & Service', () => {
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

  it('rejects conflict link when confirmConflict is false', async () => {
    // Arrange
    const mockWorker = {
      id: 'w-1',
      code: 'OP-001',
      name: 'محمود سعد',
      nickname: 'حودة',
      siteId: 'site-1',
      telegramId: null,
      isDeleted: false,
    };
    const mockConflictWorker = {
      id: 'w-old',
      code: 'OP-099',
      name: 'سعيد قديم',
      nickname: 'سعيد',
      siteId: 'site-1',
      telegramId: 888777666n,
      isDeleted: false,
    };
    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
        findFirst: vi.fn().mockResolvedValue(mockConflictWorker),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback(mockPrisma);
      }),
    } as unknown as PrismaClient;

    const repo = new UserRbacRepository(mockPrisma);
    const service = new UserRbacService(repo);

    // Act
    const conflictRes = await service.directLinkWorker('w-1', '888777666', { confirmConflict: false });

    // Assert
    expect(conflictRes.success).toBe(false);
    expect(conflictRes.reboundFromOldUser).toBe(true);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('executes atomic direct link and clean transfer when confirmConflict is true', async () => {
    // Arrange
    const mockWorker = {
      id: 'w-1',
      code: 'OP-001',
      name: 'محمود سعد',
      nickname: 'حودة',
      siteId: 'site-1',
      telegramId: null,
      isDeleted: false,
    };
    const mockConflictWorker = {
      id: 'w-old',
      code: 'OP-099',
      name: 'سعيد قديم',
      nickname: 'سعيد',
      siteId: 'site-1',
      telegramId: 888777666n,
      isDeleted: false,
    };
    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
        findFirst: vi.fn().mockResolvedValue(mockConflictWorker),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback(mockPrisma);
      }),
    } as unknown as PrismaClient;

    const repo = new UserRbacRepository(mockPrisma);
    const service = new UserRbacService(repo);

    // Act
    const successRes = await service.directLinkWorker('w-1', '888777666', { confirmConflict: true });

    // Assert
    expect(successRes.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
