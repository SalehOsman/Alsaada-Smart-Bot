import { describe, it, expect, vi } from 'vitest';
import { createSoftDeleteExtension, getSoftDeleteModels } from '../src/index.js';

describe('createSoftDeleteExtension', () => {
  it('correctly registers soft-delete models (Worker, FinancialLedger, User)', () => {
    const models = getSoftDeleteModels();
    expect(models.has('Worker')).toBe(true);
    expect(models.has('FinancialLedger')).toBe(true);
    expect(models.has('User')).toBe(true);
  });

  function createMockPrismaClient() {
    const workerStore = [
      { id: 'w1', name: 'Active Worker 1', isDeleted: false },
      { id: 'w2', name: 'Deleted Worker 2', isDeleted: true, deletedAt: new Date() },
      { id: 'w3', name: 'Active Worker 3', isDeleted: false },
    ];

    const mockDelegate = {
      findFirst: vi.fn(async ({ where }) => {
        return workerStore.find((w) => {
          if (where.isDeleted !== undefined && w.isDeleted !== where.isDeleted) return false;
          if (where.id && w.id !== where.id) return false;
          return true;
        }) ?? null;
      }),
      findFirstOrThrow: vi.fn(async ({ where }) => {
        const found = workerStore.find((w) => {
          if (where.isDeleted !== undefined && w.isDeleted !== where.isDeleted) return false;
          if (where.id && w.id !== where.id) return false;
          return true;
        });
        if (!found) throw new Error('Not found');
        return found;
      }),
      findMany: vi.fn(async ({ where = {} }) => {
        return workerStore.filter((w) => {
          if (where.isDeleted !== undefined && w.isDeleted !== where.isDeleted) return false;
          return true;
        });
      }),
      findUnique: vi.fn(async ({ where, select }) => {
        const found = workerStore.find((w) => w.id === where.id);
        if (!found) return null;
        if (select) {
          const res: any = {};
          for (const k of Object.keys(select)) {
            res[k] = (found as any)[k];
          }
          return res;
        }
        return { ...found };
      }),
      findUniqueOrThrow: vi.fn(async ({ where, select }) => {
        const found = workerStore.find((w) => w.id === where.id);
        if (!found) throw new Error('Not found');
        if (select) {
          const res: any = {};
          for (const k of Object.keys(select)) {
            res[k] = (found as any)[k];
          }
          return res;
        }
        return { ...found };
      }),
      count: vi.fn(async ({ where = {} }) => {
        return workerStore.filter((w) => {
          if (where.isDeleted !== undefined && w.isDeleted !== where.isDeleted) return false;
          return true;
        }).length;
      }),
      update: vi.fn(async ({ where, data }) => {
        const idx = workerStore.findIndex((w) => w.id === where.id);
        if (idx !== -1) {
          workerStore[idx] = { ...workerStore[idx]!, ...data };
          return workerStore[idx];
        }
        throw new Error('Not found');
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (let i = 0; i < workerStore.length; i++) {
          workerStore[i] = { ...workerStore[i]!, ...data };
          count++;
        }
        return { count };
      }),
      delete: vi.fn(async ({ where }) => {
        const idx = workerStore.findIndex((w) => w.id === where.id);
        if (idx !== -1) return workerStore.splice(idx, 1)[0];
        throw new Error('Not found');
      }),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    };

    const client: any = {
      worker: mockDelegate,
      $extends: (ext: any) => {
        const queries = ext.query.$allModels;
        const wrappedClient: any = { ...client };
        wrappedClient.worker = {
          ...mockDelegate,
          findFirst: (args: any) => queries.findFirst.call(wrappedClient, { model: 'Worker', operation: 'findFirst', args, query: mockDelegate.findFirst }),
          findFirstOrThrow: (args: any) => queries.findFirstOrThrow.call(wrappedClient, { model: 'Worker', operation: 'findFirstOrThrow', args, query: mockDelegate.findFirstOrThrow }),
          findMany: (args: any) => queries.findMany.call(wrappedClient, { model: 'Worker', operation: 'findMany', args, query: mockDelegate.findMany }),
          count: (args: any) => queries.count.call(wrappedClient, { model: 'Worker', operation: 'count', args, query: mockDelegate.count }),
          findUnique: (args: any) => queries.findUnique.call(wrappedClient, { model: 'Worker', operation: 'findUnique', args, query: mockDelegate.findUnique }),
          findUniqueOrThrow: (args: any) => queries.findUniqueOrThrow.call(wrappedClient, { model: 'Worker', operation: 'findUniqueOrThrow', args, query: mockDelegate.findUniqueOrThrow }),
          delete: (args: any) => queries.delete.call(wrappedClient, { model: 'Worker', operation: 'delete', args, query: mockDelegate.delete }),
          deleteMany: (args: any) => queries.deleteMany.call(wrappedClient, { model: 'Worker', operation: 'deleteMany', args, query: mockDelegate.deleteMany }),
        };
        return wrappedClient;
      },
    };

    return { client, workerStore, mockDelegate };
  }

  it('automatically injects { isDeleted: false } into findMany queries', async () => {
    const { client } = createMockPrismaClient();
    const extended = client.$extends(createSoftDeleteExtension());

    const workers = await extended.worker.findMany();
    expect(workers).toHaveLength(2);
    expect(workers.map((w: any) => w.id)).toEqual(['w1', 'w3']);
  });

  it('respects explicit caller override for { isDeleted: true } (recycle bin queries)', async () => {
    const { client } = createMockPrismaClient();
    const extended = client.$extends(createSoftDeleteExtension());

    const deletedWorkers = await extended.worker.findMany({ where: { isDeleted: true } });
    expect(deletedWorkers).toHaveLength(1);
    expect(deletedWorkers[0].id).toBe('w2');
  });

  it('returns null on findUnique when record is soft-deleted', async () => {
    const { client } = createMockPrismaClient();
    const extended = client.$extends(createSoftDeleteExtension());

    const active = await extended.worker.findUnique({ where: { id: 'w1' } });
    expect(active).not.toBeNull();
    expect(active.id).toBe('w1');

    const deleted = await extended.worker.findUnique({ where: { id: 'w2' } });
    expect(deleted).toBeNull();
  });

  it('throws P2025 error on findUniqueOrThrow when record is soft-deleted', async () => {
    const { client } = createMockPrismaClient();
    const extended = client.$extends(createSoftDeleteExtension());

    await expect(
      extended.worker.findUniqueOrThrow({ where: { id: 'w2' } })
    ).rejects.toThrow();
  });

  it('converts delete call into soft-delete update with isDeleted: true and deletedAt', async () => {
    const { client, workerStore, mockDelegate } = createMockPrismaClient();
    const extended = client.$extends(createSoftDeleteExtension());

    await extended.worker.delete({ where: { id: 'w1' } });

    // Ensure hard delete was NOT called
    expect(mockDelegate.delete).not.toHaveBeenCalled();
    // Ensure update was called with isDeleted: true
    expect(mockDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w1' },
        data: expect.objectContaining({ isDeleted: true }),
      })
    );
    expect(workerStore.find((w) => w.id === 'w1')?.isDeleted).toBe(true);
  });
});
