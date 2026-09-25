import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSoftDeleteExtension, getSoftDeleteModels } from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-11T12:00:00.000Z');

describe('createSoftDeleteExtension', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function createMockPrismaClient() {
    const workerStore = [
      { id: 'w1', name: 'Active Worker 1', isDeleted: false },
      { id: 'w2', name: 'Deleted Worker 2', isDeleted: true, deletedAt: PINNED_BASE_TIME },
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
          update: (args: any) => queries.update.call(wrappedClient, { model: 'Worker', operation: 'update', args, query: mockDelegate.update }),
          updateMany: (args: any) => queries.updateMany.call(wrappedClient, { model: 'Worker', operation: 'updateMany', args, query: mockDelegate.updateMany }),
          delete: (args: any) => queries.delete.call(wrappedClient, { model: 'Worker', operation: 'delete', args, query: mockDelegate.delete }),
          deleteMany: (args: any) => queries.deleteMany.call(wrappedClient, { model: 'Worker', operation: 'deleteMany', args, query: mockDelegate.deleteMany }),
        };
        return wrappedClient;
      },
    };

    return { client, workerStore, mockDelegate };
  }

  it('correctly registers soft-delete models (Worker, FinancialLedger, User)', () => {
    // Arrange
    const expectedModels = ['Worker', 'FinancialLedger', 'User'];

    // Act
    const models = getSoftDeleteModels();

    // Assert
    for (const m of expectedModels) {
      expect(models.has(m)).toBe(true);
    }
    expect(models.has('NonExistentModel')).toBe(false);
  });

  it('automatically injects { isDeleted: false } into findMany queries', async () => {
    // Arrange
    const { client } = createMockPrismaClient();
    const extended = client.$extends(createSoftDeleteExtension());

    // Act
    const workers = await extended.worker.findMany();

    // Assert
    expect(workers).toHaveLength(2);
    expect(workers.map((w: any) => w.id)).toEqual(['w1', 'w3']);
    expect(workers.some((w: any) => w.id === 'w2')).toBe(false);
  });

  it('respects explicit caller override for { isDeleted: true } (recycle bin queries)', async () => {
    // Arrange
    const { client } = createMockPrismaClient();
    const extended = client.$extends(createSoftDeleteExtension());

    // Act
    const deletedWorkers = await extended.worker.findMany({ where: { isDeleted: true } });

    // Assert
    expect(deletedWorkers).toHaveLength(1);
    expect(deletedWorkers[0].id).toBe('w2');
    expect(deletedWorkers[0].id).not.toBe('w1');
  });

  it('returns null on findUnique when record is soft-deleted', async () => {
    // Arrange
    const { client } = createMockPrismaClient();
    const extended = client.$extends(createSoftDeleteExtension());

    // Act
    const active = await extended.worker.findUnique({ where: { id: 'w1' } });
    const deleted = await extended.worker.findUnique({ where: { id: 'w2' } });

    // Assert
    expect(active).not.toBeNull();
    expect(active?.id).toBe('w1');
    expect(deleted).toBeNull();
  });

  it('throws P2025 error on findUniqueOrThrow when record is soft-deleted', async () => {
    // Arrange
    const { client } = createMockPrismaClient();
    const extended = client.$extends(createSoftDeleteExtension());

    // Act
    const action = () => extended.worker.findUniqueOrThrow({ where: { id: 'w2' } });

    // Assert
    await expect(action()).rejects.toThrow();
  });

  it('converts delete call into soft-delete update with isDeleted: true and deletedAt', async () => {
    // Arrange
    const { client, workerStore, mockDelegate } = createMockPrismaClient();
    const extended = client.$extends(createSoftDeleteExtension());

    // Act
    await extended.worker.delete({ where: { id: 'w1' } });

    // Assert
    expect(mockDelegate.delete).not.toHaveBeenCalled();
    expect(mockDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w1' },
        data: expect.objectContaining({ isDeleted: true }),
      })
    );
    expect(workerStore.find((w) => w.id === 'w1')?.isDeleted).toBe(true);
  });

  it('automatically injects { isDeleted: false } into update queries unless explicitly deleting', async () => {
    // Arrange
    const { client, mockDelegate } = createMockPrismaClient();
    const extended = client.$extends(createSoftDeleteExtension());

    // Act
    await extended.worker.update({
      where: { id: 'w1' },
      data: { name: 'Updated Worker 1' },
    });

    // Assert
    expect(mockDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isDeleted: false }),
        data: { name: 'Updated Worker 1' },
      })
    );
    expect(mockDelegate.delete).not.toHaveBeenCalled();
  });

  it('automatically injects { isDeleted: false } into updateMany queries', async () => {
    // Arrange
    const { client, mockDelegate } = createMockPrismaClient();
    const extended = client.$extends(createSoftDeleteExtension());

    // Act
    await extended.worker.updateMany({
      where: {},
      data: { name: 'Bulk Updated' },
    });

    // Assert
    expect(mockDelegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isDeleted: false }),
        data: { name: 'Bulk Updated' },
      })
    );
    expect(mockDelegate.deleteMany).not.toHaveBeenCalled();
  });

  it('schema drift guard: guarantees every model in schema.prisma with isDeleted is registered in SOFT_DELETE_MODELS', () => {
    // Arrange
    const generatedSchemaPath = resolve(__dirname, '../../../.generated/database/schema.prisma');
    const schemaPath = existsSync(generatedSchemaPath)
      ? generatedSchemaPath
      : resolve(__dirname, '../prisma/schema.prisma');
    const schemaContent = readFileSync(schemaPath, 'utf-8');

    const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
    const schemaModelsWithSoftDelete: string[] = [];
    let match: RegExpExecArray | null;

    // Act
    while ((match = modelRegex.exec(schemaContent)) !== null) {
      const modelName = match[1];
      const modelBody = match[2];
      if (modelName && modelBody && modelBody.includes('isDeleted')) {
        schemaModelsWithSoftDelete.push(modelName);
      }
    }

    const registeredModels = getSoftDeleteModels();

    // Assert
    for (const model of schemaModelsWithSoftDelete) {
      expect(
        registeredModels.has(model),
        `Schema model "${model}" contains isDeleted but is NOT registered in soft-delete-metadata.ts!`
      ).toBe(true);
    }
    expect(schemaModelsWithSoftDelete.sort()).toEqual(['FinancialLedger', 'User', 'Worker']);
    expect(registeredModels.has('RandomNonExistentEntity')).toBe(false);
  });
});
