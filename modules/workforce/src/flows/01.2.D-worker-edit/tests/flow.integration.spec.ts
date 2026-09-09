import { describe, it, expect, vi } from 'vitest';
import { WorkerEditService } from '../flow.service.js';
import { WorkerEditRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.2.D Integration Tests — Super Admin Direct Edit & Ticket Governance', () => {
  it('should apply direct edits immediately for super admin and log audit record', async () => {
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

    const result = await service.applyDirectEdit(
      'wrk-1',
      'name',
      'سالم حسن عبد الرحيم',
      BigInt(998877)
    );

    expect(result.success).toBe(true);
    expect(result.isDirectExecution).toBe(true);
    expect(workerUpdated).toBe(true);
    expect(auditCreated).toBe(true);
  });

  it('should create pending edit request ticket for field admin', async () => {
    const mockPrisma = {
      workerEditRequest: {
        count: vi.fn().mockResolvedValue(5),
        create: vi.fn().mockImplementation((args: { data: { requestId: string } }) => {
          return Promise.resolve({ id: 'ticket-uuid-1', ...args.data });
        }),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerEditRepository(mockPrisma);
    const service = new WorkerEditService(repo);

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

    expect(result.success).toBe(true);
    expect(result.isDirectExecution).toBe(false);
    expect(result.ticketId).toMatch(/^EDT-\d+-\d+$/);
  });

  it('should apply cigarette quota allocation with canteenItem link', async () => {
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

    const items = await service.getCigaretteItems('site-1');
    expect(items.length).toBe(1);

    const result = await service.applyCigaretteAllocation(
      'wrk-1',
      'ONE_PACK_DAILY',
      'كليوباترا بوكس',
      'item-cleo',
      BigInt(998877)
    );

    expect(result.success).toBe(true);
    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate!.canteenCigarettePolicy).toBe('ONE_PACK_DAILY');
    expect(capturedUpdate!.cigaretteBrand).toBe('كليوباترا بوكس');
    expect(capturedUpdate!.canteenItem).toEqual({ connect: { id: 'item-cleo' } });
  });

  it('should apply direct edits for insurance and operational fields', async () => {
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

    await service.applyDirectEdit('wrk-1', 'insuranceNumber', '12345678');
    expect(capturedUpdate.insuranceNumber).toBe('12345678');

    await service.applyDirectEdit('wrk-1', 'insuranceStatus', 'مؤمن عليه');
    expect(capturedUpdate.insuranceStatus).toBe('مؤمن عليه');

    await service.applyDirectEdit('wrk-1', 'dailyWage', '350');
    expect(String(capturedUpdate.dailyWage)).toBe('350');

    await service.applyDirectEdit('wrk-1', 'ppeShoeSize', '43');
    expect(capturedUpdate.ppeShoeSize).toBe('43');
  });
});
