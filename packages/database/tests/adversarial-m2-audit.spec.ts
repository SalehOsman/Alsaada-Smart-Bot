import { describe, it, expect, vi } from 'vitest';
import {
  verifyLedgerChainDb,
  verifyLedgerChain,
  assertLedgerChainIntegrity,
  CorruptedLedgerChainError,
  computeRecordHash,
  GENESIS_HASH,
  createSoftDeleteExtension,
  getSoftDeleteModels,
  type ChainedRecord,
} from '../src/index.js';

describe('Adversarial Challenge M2 — Ledger Audit & Soft Delete Verification', () => {
  // =========================================================================
  // SUITE 1: LEDGER AUDIT VERIFICATION & TAMPERING DETECTION
  // =========================================================================
  describe('Ledger Audit Verification (verifyLedgerChainDb & verifyLedgerChain)', () => {
    function generateDeterministicLedger(count: number) {
      const records: Array<Record<string, any>> = [];
      let previousHash = GENESIS_HASH;

      for (let i = 0; i < count; i++) {
        const id = `REC-${i + 1}`;
        const timestamp = new Date(`2026-09-11T12:${i < 10 ? '0' + i : i}:00.000Z`);
        const amount = 1000 * (i + 1);
        const actorTelegramId = `actor-${i + 1}`;

        const recordHash = computeRecordHash({
          previousHash,
          voucherNumber: `#VOUCHER-${i + 1}`,
          model: 'FinancialLedger',
          amount,
          actorId: actorTelegramId,
          timestamp,
        });

        records.push({
          id,
          voucherNumber: `#VOUCHER-${i + 1}`,
          amount,
          actorTelegramId,
          hashTimestamp: timestamp,
          createdAt: timestamp,
          previousHash,
          recordHash,
        });

        previousHash = recordHash;
      }

      return records;
    }

    function createMockPrismaForLedger(records: Array<Record<string, any>>, modelName = 'financialLedger') {
      return {
        [modelName]: {
          findMany: vi.fn(async (args: any) => {
            let list = [...records];
            if (args?.cursor?.id) {
              const idx = list.findIndex((r) => r.id === args.cursor.id);
              if (idx !== -1) list = list.slice(idx + 1);
            }
            if (args?.take) {
              list = list.slice(0, args.take);
            }
            return list;
          }),
        },
      };
    }

    it('Scenario 1.1: Valid ledger chain verifies with 100% integrity', async () => {
      const records = generateDeterministicLedger(5);
      const mockPrisma = createMockPrismaForLedger(records);

      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(true);
      expect(report.totalVerified).toBe(5);
      expect(report.brokenRecordId).toBeUndefined();
      expect(report.tamperedField).toBeUndefined();
    });

    it('Scenario 1.2: Catches modified amount tampering in intermediate record', async () => {
      const records = generateDeterministicLedger(5);
      // Malicious direct database mutation: amount changed from 3000 to 99999
      records[2]!.amount = 99999;
      const mockPrisma = createMockPrismaForLedger(records);

      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-3');
      expect(report.brokenRecordIndex).toBe(2);
      expect(report.tamperedField).toBe('recordHash');
      expect(report.error).toContain('Tampered record detected at REC-3');
    });

    it('Scenario 1.3: Catches modified hashTimestamp tampering', async () => {
      const records = generateDeterministicLedger(4);
      // Malicious direct database mutation: altering timestamp by 1 hour
      records[1]!.hashTimestamp = new Date('2026-09-11T13:01:00.000Z');
      const mockPrisma = createMockPrismaForLedger(records);

      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-2');
      expect(report.tamperedField).toBe('recordHash');
      expect(report.error).toContain('Tampered record detected at REC-2');
    });

    it('Scenario 1.4: Catches modified createdAt when hashTimestamp is omitted', async () => {
      const records = generateDeterministicLedger(4);
      // Remove hashTimestamp, tamper with createdAt
      delete records[2]!.hashTimestamp;
      records[2]!.createdAt = new Date('2025-01-01T00:00:00.000Z');
      const mockPrisma = createMockPrismaForLedger(records);

      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-3');
      expect(report.tamperedField).toBe('recordHash');
    });

    it('Scenario 1.5: Catches altered previousHash on intermediate record', async () => {
      const records = generateDeterministicLedger(5);
      // Malicious alteration of previousHash pointer
      records[3]!.previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
      const mockPrisma = createMockPrismaForLedger(records);

      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-4');
      expect(report.tamperedField).toBe('previousHash');
      expect(report.error).toContain('Broken chain link at record REC-4');
    });

    it('Scenario 1.6: Catches altered genesis previousHash on initial record', async () => {
      const records = generateDeterministicLedger(3);
      // Genesis record must point to GENESIS_HASH; alter it to fraudulent hash
      records[0]!.previousHash = 'FRAUDULENT_GENESIS_ROOT';
      const mockPrisma = createMockPrismaForLedger(records);

      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-1');
      expect(report.tamperedField).toBe('previousHash');
      expect(report.error).toContain('Broken chain link at record REC-1');
    });

    it('Scenario 1.7: Catches deleted record in chain (breaks predecessor hash link)', async () => {
      const records = generateDeterministicLedger(5);
      // Attacker deletes record at index 2 (REC-3) from database
      const splicedRecords = records.filter((r) => r.id !== 'REC-3');
      const mockPrisma = createMockPrismaForLedger(splicedRecords);

      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });
      // REC-4 expects previousHash of REC-3, but preceding record in query is REC-2
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-4');
      expect(report.tamperedField).toBe('previousHash');
      expect(report.error).toContain('Broken chain link at record REC-4');
      expect(report.expectedValue).toBe(records[1]!.recordHash); // REC-2 hash
      expect(report.actualValue).toBe(records[2]!.recordHash);   // REC-3 hash
    });

    it('Scenario 1.8: Catches deleted initial record (REC-1 deleted, REC-2 is orphan)', async () => {
      const records = generateDeterministicLedger(3);
      // Attacker deletes REC-1; now REC-2 is the first record returned
      const splicedRecords = records.slice(1);
      const mockPrisma = createMockPrismaForLedger(splicedRecords);

      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-2');
      expect(report.tamperedField).toBe('previousHash');
      expect(report.expectedValue).toBe(GENESIS_HASH);
    });

    it('Scenario 1.9: assertLedgerChainIntegrity throws CorruptedLedgerChainError on any tampering', async () => {
      const records = generateDeterministicLedger(3);
      records[1]!.amount = 42;
      const mockPrisma = createMockPrismaForLedger(records);

      await expect(
        assertLedgerChainIntegrity(mockPrisma, { model: 'FinancialLedger' })
      ).rejects.toThrow(CorruptedLedgerChainError);
    });

    it('Scenario 1.10: Universal verifyLedgerChain polymorphic dispatch', async () => {
      // 1. Array in-memory dispatch
      const inMemoryRecords: ChainedRecord[] = [
        {
          id: 'T1',
          previousHash: GENESIS_HASH,
          timestamp: '2026-09-11T12:00:00.000Z',
          amount: 500,
          currency: 'EGP',
          transactionType: 'ADVANCE',
          sourceAccount: 'CUSTODY_1',
          destinationAccount: 'WORKER_1',
          actorTelegramId: '123',
          recordHash: '',
        },
      ];
      // Compute valid hash using computeTransactionHash
      const { computeTransactionHash } = await import('../src/index.js');
      inMemoryRecords[0]!.recordHash = computeTransactionHash(inMemoryRecords[0]!);

      const memResult = verifyLedgerChain(inMemoryRecords);
      expect(memResult.isValid).toBe(true);
      expect(memResult.totalVerified).toBe(1);

      // 2. Database client dispatch
      const dbRecords = generateDeterministicLedger(2);
      const mockPrisma = createMockPrismaForLedger(dbRecords);
      const dbResult = await verifyLedgerChain(mockPrisma, { model: 'FinancialLedger' });
      expect(dbResult.isValid).toBe(true);
      expect(dbResult.totalVerified).toBe(2);
    });
  });

  // =========================================================================
  // SUITE 2: SOFT-DELETE EXTENSION VERIFICATION
  // =========================================================================
  describe('Soft-Delete Extension (soft-delete.extension.ts)', () => {
    function createMockSoftDeleteStore() {
      const store = [
        { id: 'u1', name: 'User One', role: 'ADMIN', isDeleted: false, deletedAt: null },
        { id: 'u2', name: 'User Two', role: 'OPERATOR', isDeleted: true, deletedAt: new Date('2026-09-01') },
        { id: 'u3', name: 'User Three', role: 'OPERATOR', isDeleted: false, deletedAt: null },
        { id: 'u4', name: 'User Four', role: 'OPERATOR', isDeleted: true, deletedAt: new Date('2026-09-02') },
      ];

      const rawDelegate = {
        findFirst: vi.fn(async ({ where = {} }: any) => {
          return store.find((item) => {
            if (where.isDeleted !== undefined && item.isDeleted !== where.isDeleted) return false;
            if (where.id && item.id !== where.id) return false;
            if (where.role && item.role !== where.role) return false;
            return true;
          }) ?? null;
        }),
        findMany: vi.fn(async ({ where = {} }: any) => {
          return store.filter((item) => {
            if (where.isDeleted !== undefined && item.isDeleted !== where.isDeleted) return false;
            if (where.role && item.role !== where.role) return false;
            return true;
          });
        }),
        count: vi.fn(async ({ where = {} }: any) => {
          return store.filter((item) => {
            if (where.isDeleted !== undefined && item.isDeleted !== where.isDeleted) return false;
            if (where.role && item.role !== where.role) return false;
            return true;
          }).length;
        }),
        findUnique: vi.fn(async ({ where, select }: any) => {
          const found = store.find((item) => item.id === where.id);
          if (!found) return null;
          if (select) {
            const out: any = {};
            for (const key of Object.keys(select)) {
              out[key] = (found as any)[key];
            }
            return out;
          }
          return { ...found };
        }),
        findUniqueOrThrow: vi.fn(async ({ where, select }: any) => {
          const found = store.find((item) => item.id === where.id);
          if (!found) throw new Error('Not found');
          if (select) {
            const out: any = {};
            for (const key of Object.keys(select)) {
              out[key] = (found as any)[key];
            }
            return out;
          }
          return { ...found };
        }),
        update: vi.fn(async ({ where, data, select }: any) => {
          const idx = store.findIndex((item) => item.id === where.id);
          if (idx !== -1) {
            store[idx] = { ...store[idx]!, ...data };
            if (select) {
              const out: any = {};
              for (const k of Object.keys(select)) out[k] = (store[idx] as any)[k];
              return out;
            }
            return store[idx];
          }
          throw new Error('Not found');
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          let count = 0;
          for (let i = 0; i < store.length; i++) {
            if (where?.role && store[i]!.role !== where.role) continue;
            store[i] = { ...store[i]!, ...data };
            count++;
          }
          return { count };
        }),
        delete: vi.fn(async ({ where }: any) => {
          const idx = store.findIndex((item) => item.id === where.id);
          if (idx !== -1) return store.splice(idx, 1)[0];
          throw new Error('Not found');
        }),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      };

      const baseClient: any = {
        user: rawDelegate,
        $extends: (ext: any) => {
          const queries = ext.query.$allModels;
          const extendedClient: any = { ...baseClient };
          extendedClient.user = {
            ...rawDelegate,
            findFirst: (args: any = {}) => queries.findFirst.call(extendedClient, { model: 'User', operation: 'findFirst', args, query: rawDelegate.findFirst }),
            findMany: (args: any = {}) => queries.findMany.call(extendedClient, { model: 'User', operation: 'findMany', args, query: rawDelegate.findMany }),
            count: (args: any = {}) => queries.count.call(extendedClient, { model: 'User', operation: 'count', args, query: rawDelegate.count }),
            findUnique: (args: any) => queries.findUnique.call(extendedClient, { model: 'User', operation: 'findUnique', args, query: rawDelegate.findUnique }),
            findUniqueOrThrow: (args: any) => queries.findUniqueOrThrow.call(extendedClient, { model: 'User', operation: 'findUniqueOrThrow', args, query: rawDelegate.findUniqueOrThrow }),
            delete: (args: any) => queries.delete.call(extendedClient, { model: 'User', operation: 'delete', args, query: rawDelegate.delete }),
            deleteMany: (args: any) => queries.deleteMany.call(extendedClient, { model: 'User', operation: 'deleteMany', args, query: rawDelegate.deleteMany }),
          };
          return extendedClient;
        },
      };

      return { baseClient, store, rawDelegate };
    }

    it('Scenario 2.1: findFirst automatically filters out soft-deleted records', async () => {
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // Query without explicit isDeleted
      const firstOperator = await extended.user.findFirst({ where: { role: 'OPERATOR' } });
      // u2 is soft-deleted, so findFirst must skip u2 and return u3
      expect(firstOperator).not.toBeNull();
      expect(firstOperator.id).toBe('u3');
    });

    it('Scenario 2.2: findFirst respects explicit { isDeleted: true } override', async () => {
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // Query explicitly asking for soft-deleted
      const deletedUser = await extended.user.findFirst({ where: { isDeleted: true } });
      expect(deletedUser).not.toBeNull();
      expect(deletedUser.id).toBe('u2');
      expect(deletedUser.isDeleted).toBe(true);
    });

    it('Scenario 2.3: findMany automatically filters out soft-deleted records', async () => {
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      const activeUsers = await extended.user.findMany();
      expect(activeUsers).toHaveLength(2);
      expect(activeUsers.map((u: any) => u.id)).toEqual(['u1', 'u3']);
    });

    it('Scenario 2.4: findMany respects explicit { isDeleted: true } override (recycle bin)', async () => {
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      const deletedUsers = await extended.user.findMany({ where: { isDeleted: true } });
      expect(deletedUsers).toHaveLength(2);
      expect(deletedUsers.map((u: any) => u.id)).toEqual(['u2', 'u4']);
    });

    it('Scenario 2.5: count automatically filters out soft-deleted records', async () => {
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      const activeCount = await extended.user.count();
      expect(activeCount).toBe(2);

      const operatorCount = await extended.user.count({ where: { role: 'OPERATOR' } });
      expect(operatorCount).toBe(1); // only u3
    });

    it('Scenario 2.6: count respects explicit { isDeleted: true } override', async () => {
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      const deletedCount = await extended.user.count({ where: { isDeleted: true } });
      expect(deletedCount).toBe(2); // u2 and u4
    });

    it('Scenario 2.7: findUnique returns active record, returns null for soft-deleted record', async () => {
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      const active = await extended.user.findUnique({ where: { id: 'u1' } });
      expect(active).not.toBeNull();
      expect(active.id).toBe('u1');

      const deleted = await extended.user.findUnique({ where: { id: 'u2' } });
      expect(deleted).toBeNull();
    });

    it('Scenario 2.8: findUnique cleans up injected isDeleted from select unless caller requested it', async () => {
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // 1. Caller did NOT ask for isDeleted
      const activeWithoutIsDeleted = await extended.user.findUnique({
        where: { id: 'u1' },
        select: { id: true, name: true },
      });
      expect(activeWithoutIsDeleted).toEqual({ id: 'u1', name: 'User One' });
      expect('isDeleted' in activeWithoutIsDeleted).toBe(false);

      // 2. Caller DID explicitly ask for isDeleted in select
      const activeWithIsDeleted = await extended.user.findUnique({
        where: { id: 'u1' },
        select: { id: true, name: true, isDeleted: true },
      });
      expect(activeWithIsDeleted).toEqual({ id: 'u1', name: 'User One', isDeleted: false });
    });

    it('Scenario 2.9: delete converts to soft-delete update with isDeleted: true and deletedAt', async () => {
      const { baseClient, store, rawDelegate } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      await extended.user.delete({ where: { id: 'u1' } });

      // Raw delete must NOT be called
      expect(rawDelegate.delete).not.toHaveBeenCalled();
      // Raw update must be called with soft-delete payload
      expect(rawDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({
            isDeleted: true,
            deletedAt: expect.any(Date),
          }),
        })
      );
      expect(store.find((u) => u.id === 'u1')?.isDeleted).toBe(true);
    });

    it('Scenario 2.10: deleteMany converts to soft-delete updateMany', async () => {
      const { baseClient, store, rawDelegate } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      await extended.user.deleteMany({ where: { role: 'OPERATOR' } });

      expect(rawDelegate.deleteMany).not.toHaveBeenCalled();
      expect(rawDelegate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'OPERATOR' },
          data: expect.objectContaining({
            isDeleted: true,
            deletedAt: expect.any(Date),
          }),
        })
      );
    });
  });
});
