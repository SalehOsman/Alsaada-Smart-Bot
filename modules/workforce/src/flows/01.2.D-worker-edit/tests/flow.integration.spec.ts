import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerEditService } from '../flow.service.js';
import { WorkerEditRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.2.D Integration Tests — Super Admin Direct Edit & Ticket Governance', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('applies direct edits immediately for super admin and logs audit record', async () => {
    // Arrange
    let auditCreated = false;
    let workerUpdated = false;

    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'سالم حسن',
      nickname: 'أبو سالم',
      aliases: ['أبو سالم'],
      phoneEncrypted: null,
      phoneBlindIndex: null,
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
        update: vi.fn().mockImplementation((args: { data: unknown }) => {
          workerUpdated = true;
          return Promise.resolve({ ...mockWorker, ...(args.data as object) });
        }),
      },
      auditLog: {
        create: vi.fn().mockImplementation(() => {
          auditCreated = true;
          return Promise.resolve({ id: 'audit-1' });
        }),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
    } as unknown as PrismaClient;

    const repo = new WorkerEditRepository(mockPrisma);
    const service = new WorkerEditService(repo);

    // Act
    const result = await service.applyDirectEdit(
      'wrk-1',
      'name',
      'سالم حسن عبد الرحيم',
      BigInt(998877)
    );

    // Assert
    expect(result.success).toBe(true);
    expect(result.isDirectExecution).toBe(true);
    expect(workerUpdated).toBe(true);
    expect(auditCreated).toBe(true);
  });

  it('creates pending edit request ticket for field admin without direct modification', async () => {
    // Arrange
    const mockPrisma = {
      workerEditRequest: {
        count: vi.fn().mockResolvedValue(5),
        create: vi.fn().mockImplementation((args: { data: { requestId: string } }) => {
          return Promise.resolve({ id: 'ticket-uuid-1', ...args.data });
        }),
      },
      worker: {
        update: vi.fn(),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerEditRepository(mockPrisma);
    const service = new WorkerEditService(repo);

    // Act
    const result = await service.submitEditTicket({
      workerId: 'wrk-1',
      workerCode: 'OP-001',
      workerName: 'سالم حسن',
      requesterTelegramId: BigInt(554433),
      requesterName: 'مشرف الموقع',
      requesterRole: 'FIELD_ADMIN',
      fieldKey: 'nickname',
      fieldName: 'اسم الشهرة',
      newValue: 'الكابتن سالم',
    });

    // Assert
    expect(result.success).toBe(true);
    expect(result.isDirectExecution).toBe(false);
    expect(result.ticketId).toMatch(/^EDT-\d+-\d+$/);
    expect(mockPrisma.worker.update).not.toHaveBeenCalled();
  });

  it('applies cigarette quota allocation with canteenItem link', async () => {
    // Arrange
    let capturedUpdate: Record<string, unknown> | null = null;
    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'سالم حسن',
      siteId: 'site-1',
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
        update: vi.fn().mockImplementation((args: { data: unknown }) => {
          capturedUpdate = args.data as Record<string, unknown>;
          return Promise.resolve({ ...mockWorker, ...(args.data as object) });
        }),
      },
      canteenItem: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'item-cleo', name: 'كليوباترا بوكس', sellingPrice: 55, isActive: true },
        ]),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
    } as unknown as PrismaClient;

    const repo = new WorkerEditRepository(mockPrisma);
    const service = new WorkerEditService(repo);

    // Act
    const items = await service.getCigaretteItems('site-1');
    const result = await service.applyCigaretteAllocation(
      'wrk-1',
      'ONE_PACK_DAILY',
      'كليوباترا بوكس',
      'item-cleo',
      BigInt(998877)
    );

    // Assert
    expect(items.length).toBe(1);
    expect(result.success).toBe(true);
    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate!.canteenCigarettePolicy).toBe('ONE_PACK_DAILY');
    expect(capturedUpdate!.cigaretteBrand).toBe('كليوباترا بوكس');
    expect(capturedUpdate!.canteenItem).toEqual({ connect: { id: 'item-cleo' } });
  });

  it('applies direct edits for insurance and operational fields and tracks changes in audit', async () => {
    // Arrange
    let capturedUpdate: Record<string, unknown> | null = null;
    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'سالم حسن',
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
        update: vi.fn().mockImplementation((args: { data: unknown }) => {
          capturedUpdate = args.data as Record<string, unknown>;
          return Promise.resolve({ ...mockWorker, ...(args.data as object) });
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
    } as unknown as PrismaClient;

    const repo = new WorkerEditRepository(mockPrisma);
    const service = new WorkerEditService(repo);

    // Act
    await service.applyDirectEdit('wrk-1', 'insuranceNumber', '12345678');
    const insNum = (capturedUpdate as Record<string, unknown> | null)?.insuranceNumber;

    await service.applyDirectEdit('wrk-1', 'insuranceStatus', 'مؤمن عليه');
    const insStatus = (capturedUpdate as Record<string, unknown> | null)?.insuranceStatus;

    await service.applyDirectEdit('wrk-1', 'dailyWage', '350');
    const dWage = String((capturedUpdate as Record<string, unknown> | null)?.dailyWage);

    await service.applyDirectEdit('wrk-1', 'ppeShoeSize', '43');
    const ppeSize = (capturedUpdate as Record<string, unknown> | null)?.ppeShoeSize;

    // Assert
    expect(insNum).toBe('12345678');
    expect(insStatus).toBe('مؤمن عليه');
    expect(dWage).toBe('350');
    expect(ppeSize).toBe('43');
  });

  it('rejects direct edit when target worker does not exist in repository', async () => {
    // Arrange
    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerEditRepository(mockPrisma);
    const service = new WorkerEditService(repo);

    // Act
    const result = await service.applyDirectEdit('non-existent-worker', 'nickname', 'أبو علي');

    // Assert
    expect(result.success).toBe(false);
    expect(result.isDirectExecution).toBe(true);
    expect(result.error).toContain('لم يتم العثور على العامل');
  });
});
