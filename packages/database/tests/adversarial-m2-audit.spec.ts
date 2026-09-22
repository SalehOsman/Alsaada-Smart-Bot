import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  verifyLedgerChainDb,
  verifyLedgerChain,
  assertLedgerChainIntegrity,
  CorruptedLedgerChainError,
  computeRecordHash,
  GENESIS_HASH,
  createSoftDeleteExtension,
  computeTransactionHash,
  type ChainedRecord,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-11T12:00:00.000Z');

describe('Adversarial Challenge M2 — Ledger Audit & Soft Delete Verification', () => {
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

    it('01: verifies valid ledger chain with complete cryptographic integrity', async () => {
      // Arrange
      const records = generateDeterministicLedger(5);
      const mockPrisma = createMockPrismaForLedger(records);

      // Act
      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });

      // Assert
      expect(report.isValid).toBe(true);
      expect(report.totalVerified).toBe(5);
      expect(report.brokenRecordId).toBeUndefined();
      expect(report.tamperedField).toBeUndefined();
    });

    it('02: catches modified amount tampering in intermediate record', async () => {
      // Arrange
      const records = generateDeterministicLedger(5);
      records[2]!.amount = 99999;
      const mockPrisma = createMockPrismaForLedger(records);

      // Act
      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });

      // Assert
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-3');
      expect(report.brokenRecordIndex).toBe(2);
      expect(report.tamperedField).toBe('recordHash');
      expect(report.error).toContain('Tampered record detected at REC-3');
    });

    it('03: catches modified hashTimestamp tampering', async () => {
      // Arrange
      const records = generateDeterministicLedger(4);
      records[1]!.hashTimestamp = new Date('2026-09-11T13:01:00.000Z');
      const mockPrisma = createMockPrismaForLedger(records);

      // Act
      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });

      // Assert
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-2');
      expect(report.tamperedField).toBe('recordHash');
      expect(report.error).toContain('Tampered record detected at REC-2');
    });

    it('04: catches modified createdAt when hashTimestamp is omitted', async () => {
      // Arrange
      const records = generateDeterministicLedger(4);
      delete records[2]!.hashTimestamp;
      records[2]!.createdAt = new Date('2025-01-01T00:00:00.000Z');
      const mockPrisma = createMockPrismaForLedger(records);

      // Act
      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });

      // Assert
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-3');
      expect(report.tamperedField).toBe('recordHash');
    });

    it('05: catches altered previousHash on intermediate record', async () => {
      // Arrange
      const records = generateDeterministicLedger(5);
      records[3]!.previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
      const mockPrisma = createMockPrismaForLedger(records);

      // Act
      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });

      // Assert
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-4');
      expect(report.tamperedField).toBe('previousHash');
      expect(report.error).toContain('Broken chain link at record REC-4');
    });

    it('06: catches altered genesis previousHash on initial record', async () => {
      // Arrange
      const records = generateDeterministicLedger(3);
      records[0]!.previousHash = 'FRAUDULENT_GENESIS_ROOT';
      const mockPrisma = createMockPrismaForLedger(records);

      // Act
      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });

      // Assert
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-1');
      expect(report.tamperedField).toBe('previousHash');
      expect(report.error).toContain('Broken chain link at record REC-1');
    });

    it('07: catches deleted record in chain breaking predecessor hash link', async () => {
      // Arrange
      const records = generateDeterministicLedger(5);
      const splicedRecords = records.filter((r) => r.id !== 'REC-3');
      const mockPrisma = createMockPrismaForLedger(splicedRecords);

      // Act
      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });

      // Assert
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-4');
      expect(report.tamperedField).toBe('previousHash');
      expect(report.error).toContain('Broken chain link at record REC-4');
      expect(report.expectedValue).toBe(records[1]!.recordHash);
      expect(report.actualValue).toBe(records[2]!.recordHash);
    });

    it('08: catches deleted initial record leaving second record orphaned', async () => {
      // Arrange
      const records = generateDeterministicLedger(3);
      const splicedRecords = records.slice(1);
      const mockPrisma = createMockPrismaForLedger(splicedRecords);

      // Act
      const report = await verifyLedgerChainDb(mockPrisma, { model: 'FinancialLedger' });

      // Assert
      expect(report.isValid).toBe(false);
      expect(report.brokenRecordId).toBe('REC-2');
      expect(report.tamperedField).toBe('previousHash');
      expect(report.expectedValue).toBe(GENESIS_HASH);
    });

    it('09: throws CorruptedLedgerChainError on any detected tampering', async () => {
      // Arrange
      const records = generateDeterministicLedger(3);
      records[1]!.amount = 42;
      const mockPrisma = createMockPrismaForLedger(records);

      // Act
      const integrityAssertion = assertLedgerChainIntegrity(mockPrisma, { model: 'FinancialLedger' });

      // Assert
      await expect(integrityAssertion).rejects.toThrow(CorruptedLedgerChainError);
    });

    it('10: dispatches polymorphic ledger verification across array and database models', async () => {
      // Arrange
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
      inMemoryRecords[0]!.recordHash = computeTransactionHash(inMemoryRecords[0]!);

      const dbRecords = generateDeterministicLedger(2);
      const mockPrisma = createMockPrismaForLedger(dbRecords);

      // Act
      const memResult = verifyLedgerChain(inMemoryRecords);
      const dbResult = await verifyLedgerChain(mockPrisma, { model: 'FinancialLedger' });

      // Assert
      expect(memResult.isValid).toBe(true);
      expect(memResult.totalVerified).toBe(1);
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
        { id: 'u2', name: 'User Two', role: 'OPERATOR', isDeleted: true, deletedAt: new Date('2026-09-01T00:00:00.000Z') },
        { id: 'u3', name: 'User Three', role: 'OPERATOR', isDeleted: false, deletedAt: null },
        { id: 'u4', name: 'User Four', role: 'OPERATOR', isDeleted: true, deletedAt: new Date('2026-09-02T00:00:00.000Z') },
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

    it('11: automatically filters out soft-deleted records in findFirst', async () => {
      // Arrange
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // Act
      const firstOperator = await extended.user.findFirst({ where: { role: 'OPERATOR' } });

      // Assert
      expect(firstOperator).not.toBeNull();
      expect(firstOperator.id).toBe('u3');
    });

    it('12: respects explicit isDeleted true override in findFirst', async () => {
      // Arrange
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // Act
      const deletedUser = await extended.user.findFirst({ where: { isDeleted: true } });

      // Assert
      expect(deletedUser).not.toBeNull();
      expect(deletedUser.id).toBe('u2');
      expect(deletedUser.isDeleted).toBe(true);
    });

    it('13: automatically filters out soft-deleted records in findMany', async () => {
      // Arrange
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // Act
      const activeUsers = await extended.user.findMany();

      // Assert
      expect(activeUsers).toHaveLength(2);
      expect(activeUsers.map((u: any) => u.id)).toEqual(['u1', 'u3']);
    });

    it('14: respects explicit isDeleted true override in findMany for recycle bin inspection', async () => {
      // Arrange
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // Act
      const deletedUsers = await extended.user.findMany({ where: { isDeleted: true } });

      // Assert
      expect(deletedUsers).toHaveLength(2);
      expect(deletedUsers.map((u: any) => u.id)).toEqual(['u2', 'u4']);
    });

    it('15: automatically filters out soft-deleted records in count', async () => {
      // Arrange
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // Act
      const activeCount = await extended.user.count();
      const operatorCount = await extended.user.count({ where: { role: 'OPERATOR' } });

      // Assert
      expect(activeCount).toBe(2);
      expect(operatorCount).toBe(1);
    });

    it('16: respects explicit isDeleted true override in count', async () => {
      // Arrange
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // Act
      const deletedCount = await extended.user.count({ where: { isDeleted: true } });

      // Assert
      expect(deletedCount).toBe(2);
    });

    it('17: returns active record and null for soft-deleted record in findUnique', async () => {
      // Arrange
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // Act
      const active = await extended.user.findUnique({ where: { id: 'u1' } });
      const deleted = await extended.user.findUnique({ where: { id: 'u2' } });

      // Assert
      expect(active).not.toBeNull();
      expect(active.id).toBe('u1');
      expect(deleted).toBeNull();
    });

    it('18: cleans up injected isDeleted from select unless caller requested it', async () => {
      // Arrange
      const { baseClient } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // Act
      const activeWithoutIsDeleted = await extended.user.findUnique({
        where: { id: 'u1' },
        select: { id: true, name: true },
      });
      const activeWithIsDeleted = await extended.user.findUnique({
        where: { id: 'u1' },
        select: { id: true, name: true, isDeleted: true },
      });

      // Assert
      expect(activeWithoutIsDeleted).toEqual({ id: 'u1', name: 'User One' });
      expect('isDeleted' in activeWithoutIsDeleted).toBe(false);
      expect(activeWithIsDeleted).toEqual({ id: 'u1', name: 'User One', isDeleted: false });
    });

    it('19: converts delete operation to soft-delete update with isDeleted true and deletedAt', async () => {
      // Arrange
      const { baseClient, store, rawDelegate } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // Act
      await extended.user.delete({ where: { id: 'u1' } });

      // Assert
      expect(rawDelegate.delete).not.toHaveBeenCalled();
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

    it('20: converts deleteMany operation to soft-delete updateMany', async () => {
      // Arrange
      const { baseClient, rawDelegate } = createMockSoftDeleteStore();
      const extended = baseClient.$extends(createSoftDeleteExtension());

      // Act
      await extended.user.deleteMany({ where: { role: 'OPERATOR' } });

      // Assert
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
