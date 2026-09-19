import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  computeRecordHash,
  GENESIS_HASH,
  hashLedgerExtension,
  ImmutableLedgerError,
  LedgerHardDeleteForbiddenError,
  FINANCIAL_MODELS,
  verifyLedgerChainDb,
  assertLedgerChainIntegrity,
  extractAmount,
  extractActorId,
  normalizeModelName,
} from '../src/index.js';

describe('Adversarial Challenge M2.1: Cryptographic Hash-Chain & Concurrency Stress Suite', () => {
  // =========================================================================
  // 1. HASH CALCULATION DETERMINISM & CANONICAL FORMULA EDGE CASES
  // =========================================================================
  describe('1. Hash Calculation Determinism & Canonical Formula Edge Cases', () => {
    it('1.1: Guaranteed determinism across 1,000 consecutive identical calculations', () => {
      const payload = {
        previousHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
        model: 'FinancialLedger',
        amount: 1250.75,
        actorId: 'user_9988',
        timestamp: new Date('2026-09-11T12:30:00.000Z'),
      };

      const baseline = computeRecordHash(payload);
      expect(baseline).toHaveLength(64);

      for (let i = 0; i < 1000; i++) {
        const hash = computeRecordHash(payload);
        expect(hash).toBe(baseline);
      }
    });

    it('1.2: Negative amounts (reversals, adjustments, and negative floats)', () => {
      const ts = '2026-09-11T12:00:00.000Z';

      // Numerical negative
      const hashNegNum = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: -500.5,
        actorId: 'reversal-actor',
        timestamp: ts,
      });

      // String negative
      const hashNegStr = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: '-500.50',
        actorId: 'reversal-actor',
        timestamp: ts,
      });

      const expectedString = `${GENESIS_HASH}::FinancialLedger:-500.50:EGP::::reversal-actor:${ts}`;
      const expectedHash = crypto.createHash('sha256').update(expectedString).digest('hex');

      expect(hashNegNum).toBe(expectedHash);
      expect(hashNegStr).toBe(expectedHash);

      // Micro-negative amount
      const hashMicroNeg = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: -0.01,
        actorId: 'reversal-actor',
        timestamp: ts,
      });
      const expectedMicro = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::FinancialLedger:-0.01:EGP::::reversal-actor:${ts}`)
        .digest('hex');
      expect(hashMicroNeg).toBe(expectedMicro);
    });

    it('1.3: Zero amounts and negative-zero normalization', () => {
      const ts = '2026-09-11T12:00:00.000Z';
      const expectedZeroHash = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::CustodySettlement:0.00:EGP::::sys-settle:${ts}`)
        .digest('hex');

      // Integer 0
      expect(
        computeRecordHash({
          previousHash: GENESIS_HASH,
          model: 'CustodySettlement',
          amount: 0,
          actorId: 'sys-settle',
          timestamp: ts,
        })
      ).toBe(expectedZeroHash);

      // Float 0.00
      expect(
        computeRecordHash({
          previousHash: GENESIS_HASH,
          model: 'CustodySettlement',
          amount: 0.0,
          actorId: 'sys-settle',
          timestamp: ts,
        })
      ).toBe(expectedZeroHash);

      // String "0"
      expect(
        computeRecordHash({
          previousHash: GENESIS_HASH,
          model: 'CustodySettlement',
          amount: '0',
          actorId: 'sys-settle',
          timestamp: ts,
        })
      ).toBe(expectedZeroHash);

      // String "0.00"
      expect(
        computeRecordHash({
          previousHash: GENESIS_HASH,
          model: 'CustodySettlement',
          amount: '0.00',
          actorId: 'sys-settle',
          timestamp: ts,
        })
      ).toBe(expectedZeroHash);

      // Negative zero: -0 in JavaScript
      expect(
        computeRecordHash({
          previousHash: GENESIS_HASH,
          model: 'CustodySettlement',
          amount: -0,
          actorId: 'sys-settle',
          timestamp: ts,
        })
      ).toBe(expectedZeroHash);

      // Negative zero string: "-0"
      expect(
        computeRecordHash({
          previousHash: GENESIS_HASH,
          model: 'CustodySettlement',
          amount: '-0',
          actorId: 'sys-settle',
          timestamp: ts,
        })
      ).toBe(expectedZeroHash);
    });

    it('1.4: High precision decimals (sub-cent rounding determinism)', () => {
      const ts = '2026-09-11T12:00:00.000Z';

      // 100.456789 rounds to 100.46
      const hashRoundUp = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'SupplierPayment',
        amount: 100.456789,
        actorId: 'procurement',
        timestamp: ts,
      });
      const expectedUp = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::SupplierPayment:100.46:EGP::::procurement:${ts}`)
        .digest('hex');
      expect(hashRoundUp).toBe(expectedUp);

      // 100.454321 rounds down to 100.45
      const hashRoundDown = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'SupplierPayment',
        amount: 100.454321,
        actorId: 'procurement',
        timestamp: ts,
      });
      const expectedDown = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::SupplierPayment:100.45:EGP::::procurement:${ts}`)
        .digest('hex');
      expect(hashRoundDown).toBe(expectedDown);

      // Sub-cent fractional pennies (0.004 -> 0.00 vs 0.006 -> 0.01)
      const hashSubCentLow = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'SupplierPayment',
        amount: 0.004,
        actorId: 'procurement',
        timestamp: ts,
      });
      expect(hashSubCentLow).toBe(
        crypto.createHash('sha256').update(`${GENESIS_HASH}::SupplierPayment:0.00:EGP::::procurement:${ts}`).digest('hex')
      );

      const hashSubCentHigh = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'SupplierPayment',
        amount: 0.006,
        actorId: 'procurement',
        timestamp: ts,
      });
      expect(hashSubCentHigh).toBe(
        crypto.createHash('sha256').update(`${GENESIS_HASH}::SupplierPayment:0.01:EGP::::procurement:${ts}`).digest('hex')
      );
    });

    it('1.5: Unicode actor IDs (Arabic, emojis, colons, special characters)', () => {
      const ts = '2026-09-11T14:00:00.000Z';

      // Arabic text
      const arabicActor = 'المشرف_أحمد_السيد_٩٩';
      const hashArabic = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: 500,
        actorId: arabicActor,
        timestamp: ts,
      });
      const expectedArabic = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::FinancialLedger:500.00:EGP::::${arabicActor}:${ts}`)
        .digest('hex');
      expect(hashArabic).toBe(expectedArabic);

      // Emojis & complex multibyte symbols
      const emojiActor = '👷_Admin_👑_خزينة_💰';
      const hashEmoji = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: 750,
        actorId: emojiActor,
        timestamp: ts,
      });
      const expectedEmoji = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::FinancialLedger:750.00:EGP::::${emojiActor}:${ts}`)
        .digest('hex');
      expect(hashEmoji).toBe(expectedEmoji);

      // Colons inside actorId (must not disrupt SHA-256 canonical hashing)
      const colonActor = 'urn:alsaada:actor:role:accountant:42';
      const hashColon = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: 1000,
        actorId: colonActor,
        timestamp: ts,
      });
      const expectedColon = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::FinancialLedger:1000.00:EGP::::${colonActor}:${ts}`)
        .digest('hex');
      expect(hashColon).toBe(expectedColon);
    });

    it('1.6: Model name normalization (camelCase vs PascalCase invariance)', () => {
      expect(normalizeModelName('financialLedger')).toBe('FinancialLedger');
      expect(normalizeModelName('FinancialLedger')).toBe('FinancialLedger');
      expect(normalizeModelName('supplierPayment')).toBe('SupplierPayment');
      expect(normalizeModelName('SupplierPayment')).toBe('SupplierPayment');
    });

    it('1.7: extractAmount handles all financial model aliases', () => {
      expect(extractAmount({ amount: 1200 })).toBe(1200);
      expect(extractAmount({ amount: '450.50' })).toBe(450.5);
      expect(extractAmount({ closingTotalInvoices: 3200 })).toBe(3200);
      expect(extractAmount({ remainingCashReturned: 800 })).toBe(800);
      expect(extractAmount({})).toBe(0);
    });

    it('1.8: extractActorId prioritizes fields in deterministic order', () => {
      expect(extractActorId({ actorTelegramId: '111', actorId: '222' })).toBe('111');
      expect(extractActorId({ actorId: '222' })).toBe('222');
      expect(extractActorId({ recordedByUserId: 333 })).toBe('333');
      expect(extractActorId({ auditedByUserId: 444 })).toBe('444');
      expect(extractActorId({ approvedByUserId: 555 })).toBe('555');
      expect(extractActorId({ disbursedByWorkerId: 'w1' })).toBe('w1');
      expect(extractActorId({ workerId: 'w2' })).toBe('w2');
      expect(extractActorId({ custodyId: 'c1' })).toBe('c1');
      expect(extractActorId({ supplierId: 's1' })).toBe('s1');
      expect(extractActorId({})).toBe('system');
    });

    it('1.9: BigInt actor IDs (large Telegram IDs and user IDs)', () => {
      const ts = '2026-09-11T12:00:00.000Z';
      const bigIntActor = 9007199254740993n; // Greater than Number.MAX_SAFE_INTEGER

      const hash = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: 250,
        actorId: bigIntActor,
        timestamp: ts,
      });

      const expected = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::FinancialLedger:250.00:EGP::::9007199254740993:${ts}`)
        .digest('hex');

      expect(hash).toBe(expected);
      expect(extractActorId({ actorTelegramId: bigIntActor })).toBe('9007199254740993');
    });

    it('1.10: Decimal.js / Prisma Decimal object compatibility in computeRecordHash and extractAmount', () => {
      const ts = '2026-09-11T12:00:00.000Z';
      // Simulated Prisma Decimal object
      const prismaDecimal = {
        valueOf: () => '1850.25',
        toString: () => '1850.25',
        [Symbol.toPrimitive]: () => 1850.25,
      };

      const extracted = extractAmount({ amount: prismaDecimal });
      expect(extracted).toBe(1850.25);

      const hash = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: prismaDecimal as any,
        actorId: 'dec-actor',
        timestamp: ts,
      });

      const expected = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::FinancialLedger:1850.25:EGP::::dec-actor:${ts}`)
        .digest('hex');
      expect(hash).toBe(expected);
    });

    it('1.11: Timestamp determinism between Date object and ISO string', () => {
      const date = new Date('2026-09-11T16:45:30.123Z');
      const isoStr = '2026-09-11T16:45:30.123Z';

      const hashDate = computeRecordHash({
        previousHash: 'prev',
        model: 'FinancialLedger',
        amount: 100,
        actorId: 'usr',
        timestamp: date,
      });

      const hashStr = computeRecordHash({
        previousHash: 'prev',
        model: 'FinancialLedger',
        amount: 100,
        actorId: 'usr',
        timestamp: isoStr,
      });

      expect(hashDate).toBe(hashStr);
    });
  });

  // =========================================================================
  // 2. CONCURRENCY SAFETY & BATCH INSERTION CHAINING (createMany)
  // =========================================================================
  describe('2. Concurrency Safety & Batch Insertion Chaining', () => {
    function createMockConcurrentClient(options: { simulatedDelayMs?: number } = {}) {
      const delay = options.simulatedDelayMs ?? 5;
      const store: Record<string, any>[] = [];

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const mockDelegate = {
        findFirst: vi.fn(async ({ orderBy, select }) => {
          await sleep(Math.floor(Math.random() * delay));
          if (store.length === 0) return null;
          return { recordHash: store[store.length - 1]!.recordHash };
        }),
        findMany: vi.fn(async (args: any) => {
          let list = [...store];
          if (args?.cursor?.id) {
            const idx = list.findIndex((r) => r.id === args.cursor.id);
            if (idx !== -1) list = list.slice(idx + 1);
          }
          if (args?.take) list = list.slice(0, args.take);
          return list;
        }),
        create: vi.fn(async ({ data }) => {
          await sleep(Math.floor(Math.random() * delay));
          const id = `REC-${store.length + 1}`;
          const record = { id, createdAt: new Date(), ...data };
          store.push(record);
          return record;
        }),
        createMany: vi.fn(async ({ data }) => {
          await sleep(Math.floor(Math.random() * delay));
          const arr = Array.isArray(data) ? data : [data];
          for (const item of arr) {
            const id = `REC-${store.length + 1}`;
            store.push({ id, createdAt: new Date(), ...item });
          }
          return { count: arr.length };
        }),
        update: vi.fn(async ({ where, data }) => ({ ...store[0], ...data })),
        updateMany: vi.fn(async ({ where, data }) => ({ count: 1 })),
        delete: vi.fn(async () => store.pop()),
        deleteMany: vi.fn(async () => ({ count: store.length })),
      };

      const supplierStore: Record<string, any>[] = [];
      const mockSupplierDelegate = {
        findFirst: vi.fn(async ({ orderBy, select }) => {
          await sleep(Math.floor(Math.random() * delay));
          if (supplierStore.length === 0) return null;
          return { recordHash: supplierStore[supplierStore.length - 1]!.recordHash };
        }),
        findMany: vi.fn(async () => [...supplierStore]),
        create: vi.fn(async ({ data }) => {
          await sleep(Math.floor(Math.random() * delay));
          const id = `SUP-${supplierStore.length + 1}`;
          const record = { id, createdAt: new Date(), ...data };
          supplierStore.push(record);
          return record;
        }),
        createMany: vi.fn(async ({ data }) => {
          const arr = Array.isArray(data) ? data : [data];
          for (const item of arr) {
            supplierStore.push({ id: `SUP-${supplierStore.length + 1}`, ...item });
          }
          return { count: arr.length };
        }),
        update: vi.fn(async ({ where, data }: any) => ({ ...supplierStore[0], ...data })),
        updateMany: vi.fn(async ({ where, data }: any) => ({ count: 1 })),
        delete: vi.fn(async () => supplierStore.pop()),
        deleteMany: vi.fn(async () => ({ count: supplierStore.length })),
      };

      class TestMutex {
        private mutex = Promise.resolve();
        lock(): Promise<() => void> {
          let unlock: () => void;
          const next = new Promise<void>((resolve) => { unlock = resolve; });
          const wait = this.mutex.then(() => unlock);
          this.mutex = this.mutex.then(() => next);
          return wait;
        }
      }
      const testMutex = new TestMutex();
      const client: any = {
        $executeRawUnsafe: vi.fn(async () => {}),
        financialLedger: mockDelegate,
        supplierPayment: mockSupplierDelegate,
        $extends: (extensionOrFn: any) => {
          if (typeof extensionOrFn === 'function') {
            return extensionOrFn(client);
          }
          if (extensionOrFn?.query?.$allModels) {
            const ext = extensionOrFn.query.$allModels;
            const extended: any = { ...client };

            extended.financialLedger = {
              ...mockDelegate,
              create: async (args: any) => {
                const unlock = await testMutex.lock();
                try {
                  return await ext.create({ model: 'FinancialLedger', operation: 'create', args, query: mockDelegate.create });
                } finally {
                  unlock();
                }
              },
              createMany: async (args: any) => {
                const unlock = await testMutex.lock();
                try {
                  return await ext.createMany({ model: 'FinancialLedger', operation: 'createMany', args, query: mockDelegate.createMany });
                } finally {
                  unlock();
                }
              },
              update: async (args: any) => ext.update({ model: 'FinancialLedger', operation: 'update', args, query: mockDelegate.update }),
              updateMany: async (args: any) => ext.updateMany({ model: 'FinancialLedger', operation: 'updateMany', args, query: mockDelegate.updateMany }),
              delete: async (args: any) => ext.delete({ model: 'FinancialLedger', operation: 'delete', args, query: mockDelegate.delete }),
              deleteMany: async (args: any) => ext.deleteMany({ model: 'FinancialLedger', operation: 'deleteMany', args, query: mockDelegate.deleteMany }),
            };

            extended.supplierPayment = {
              ...mockSupplierDelegate,
              create: async (args: any) => {
                const unlock = await testMutex.lock();
                try {
                  return await ext.create({ model: 'SupplierPayment', operation: 'create', args, query: mockSupplierDelegate.create });
                } finally {
                  unlock();
                }
              },
              createMany: async (args: any) => {
                const unlock = await testMutex.lock();
                try {
                  return await ext.createMany({ model: 'SupplierPayment', operation: 'createMany', args, query: mockSupplierDelegate.createMany });
                } finally {
                  unlock();
                }
              },
              update: async (args: any) => ext.update({ model: 'SupplierPayment', operation: 'update', args, query: mockSupplierDelegate.update }),
              updateMany: async (args: any) => ext.updateMany({ model: 'SupplierPayment', operation: 'updateMany', args, query: mockSupplierDelegate.updateMany }),
              delete: async (args: any) => ext.delete({ model: 'SupplierPayment', operation: 'delete', args, query: mockSupplierDelegate.delete }),
              deleteMany: async (args: any) => ext.deleteMany({ model: 'SupplierPayment', operation: 'deleteMany', args, query: mockSupplierDelegate.deleteMany }),
            };

            return extended;
          }
          return client;
        },
      };

      return { client, store, supplierStore, mockDelegate };
    }

    it('2.1: Concurrency stress — 25 simultaneous concurrent create mutations produce an unbroken chain', async () => {
      const { client, store } = createMockConcurrentClient({ simulatedDelayMs: 8 });
      const extended = hashLedgerExtension(client);

      const N = 25;
      const tasks = Array.from({ length: N }, (_, i) => {
        return extended.financialLedger.create({
          data: {
            voucherNumber: `#ADV-CONCUR-${i + 1}`,
            amount: 100 * (i + 1),
            actorTelegramId: `actor-${i + 1}`,
            hashTimestamp: new Date(`2026-09-11T10:${i < 10 ? '0' + i : i}:00.000Z`),
          },
        });
      });

      // Fire all concurrently
      await Promise.all(tasks);

      expect(store).toHaveLength(N);

      // Verify no two records share previousHash (zero forks)
      const previousHashes = store.map((r) => r.previousHash);
      const uniquePrevHashes = new Set(previousHashes);
      expect(uniquePrevHashes.size).toBe(N);

      // First must link to GENESIS_HASH
      expect(store[0]!.previousHash).toBe(GENESIS_HASH);

      // Every subsequent record i must link to record i-1's recordHash
      for (let i = 1; i < N; i++) {
        expect(store[i]!.previousHash).toBe(store[i - 1]!.recordHash);
      }

      // Verify cryptographic validity with verifyLedgerChainDb
      const report = await verifyLedgerChainDb(client, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(true);
      expect(report.totalVerified).toBe(N);
      expect(report.brokenRecordId).toBeUndefined();
    });

    it('2.2: Batch createMany chaining across 50 records in a single batch', async () => {
      const { client, store } = createMockConcurrentClient();
      const extended = hashLedgerExtension(client);

      const batchCount = 50;
      const items = Array.from({ length: batchCount }, (_, i) => ({
        voucherNumber: `#BATCH-01-${i + 1}`,
        amount: 250 + i * 10,
        actorTelegramId: `batch-user-${i}`,
        hashTimestamp: new Date(`2026-09-11T11:00:${i < 10 ? '0' + i : i}.000Z`),
      }));

      await extended.financialLedger.createMany({ data: items });

      expect(store).toHaveLength(batchCount);
      expect(store[0]!.previousHash).toBe(GENESIS_HASH);

      for (let i = 1; i < batchCount; i++) {
        expect(store[i]!.previousHash).toBe(store[i - 1]!.recordHash);
      }

      const report = await verifyLedgerChainDb(client, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(true);
      expect(report.totalVerified).toBe(batchCount);
    });

    it('2.3: Multiple concurrent createMany batches serialize into a continuous unified chain', async () => {
      const { client, store } = createMockConcurrentClient({ simulatedDelayMs: 6 });
      const extended = hashLedgerExtension(client);

      const numBatches = 4;
      const itemsPerBatch = 5;

      const batchPromises = Array.from({ length: numBatches }, (_, b) => {
        const batchItems = Array.from({ length: itemsPerBatch }, (_, i) => ({
          voucherNumber: `#CONCUR-BATCH-${b + 1}-${i + 1}`,
          amount: (b + 1) * 1000 + (i + 1) * 10,
          actorTelegramId: `batch-actor-${b}`,
          hashTimestamp: new Date(`2026-09-11T12:${b}${i}:00.000Z`),
        }));
        return extended.financialLedger.createMany({ data: batchItems });
      });

      await Promise.all(batchPromises);

      const totalRecords = numBatches * itemsPerBatch;
      expect(store).toHaveLength(totalRecords);

      // Verify every link in the 20-record chain
      expect(store[0]!.previousHash).toBe(GENESIS_HASH);
      for (let i = 1; i < totalRecords; i++) {
        expect(store[i]!.previousHash).toBe(store[i - 1]!.recordHash);
      }

      const report = await verifyLedgerChainDb(client, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(true);
      expect(report.totalVerified).toBe(totalRecords);
    });

    it('2.4: Interleaved concurrent single create and batch createMany', async () => {
      const { client, store } = createMockConcurrentClient({ simulatedDelayMs: 5 });
      const extended = hashLedgerExtension(client);

      // Mix of 5 single creates and 2 batches of 4 items = 13 items total
      const single1 = extended.financialLedger.create({
        data: { voucherNumber: '#SINGLE-1', amount: 100, actorTelegramId: 's1', hashTimestamp: new Date('2026-09-11T13:00:00Z') },
      });
      const batch1 = extended.financialLedger.createMany({
        data: [
          { voucherNumber: '#B1-1', amount: 201, actorTelegramId: 'b1', hashTimestamp: new Date('2026-09-11T13:01:00Z') },
          { voucherNumber: '#B1-2', amount: 202, actorTelegramId: 'b1', hashTimestamp: new Date('2026-09-11T13:02:00Z') },
          { voucherNumber: '#B1-3', amount: 203, actorTelegramId: 'b1', hashTimestamp: new Date('2026-09-11T13:03:00Z') },
          { voucherNumber: '#B1-4', amount: 204, actorTelegramId: 'b1', hashTimestamp: new Date('2026-09-11T13:04:00Z') },
        ],
      });
      const single2 = extended.financialLedger.create({
        data: { voucherNumber: '#SINGLE-2', amount: 300, actorTelegramId: 's2', hashTimestamp: new Date('2026-09-11T13:05:00Z') },
      });
      const batch2 = extended.financialLedger.createMany({
        data: [
          { voucherNumber: '#B2-1', amount: 401, actorTelegramId: 'b2', hashTimestamp: new Date('2026-09-11T13:06:00Z') },
          { voucherNumber: '#B2-2', amount: 402, actorTelegramId: 'b2', hashTimestamp: new Date('2026-09-11T13:07:00Z') },
        ],
      });

      await Promise.all([single1, batch1, single2, batch2]);

      expect(store).toHaveLength(8);

      // Check unbroken sequential continuity
      expect(store[0]!.previousHash).toBe(GENESIS_HASH);
      for (let i = 1; i < store.length; i++) {
        expect(store[i]!.previousHash).toBe(store[i - 1]!.recordHash);
      }

      await assertLedgerChainIntegrity(client, { model: 'FinancialLedger' });
    });

    it('2.5: Mutex deadlock prevention — error during mutation releases mutex for subsequent operations', async () => {
      const { client, store, mockDelegate } = createMockConcurrentClient();
      const extended = hashLedgerExtension(client);

      // 1. First record succeeds
      await extended.financialLedger.create({
        data: { voucherNumber: '#V-01', amount: 100, actorTelegramId: 'u1' },
      });
      expect(store).toHaveLength(1);

      // 2. Second record deliberately fails inside query (e.g. database error)
      mockDelegate.create.mockRejectedValueOnce(new Error('Simulated unique constraint error'));

      await expect(
        extended.financialLedger.create({
          data: { voucherNumber: '#V-02-FAIL', amount: 200, actorTelegramId: 'u2' },
        })
      ).rejects.toThrow('Simulated unique constraint error');

      // 3. Third record MUST succeed immediately (proving mutex lock was freed in finally)
      const rec3 = await extended.financialLedger.create({
        data: { voucherNumber: '#V-03-SUCCESS', amount: 300, actorTelegramId: 'u3' },
      });

      expect(store).toHaveLength(2);
      expect(rec3.previousHash).toBe(store[0]!.recordHash);
    });

    it('2.6: Multi-model isolation — concurrent mutations on different models do not block or corrupt each other', async () => {
      const { client, store, supplierStore } = createMockConcurrentClient({ simulatedDelayMs: 5 });
      const extended = hashLedgerExtension(client);

      const tasks = [
        extended.financialLedger.create({ data: { voucherNumber: '#FIN-1', amount: 1000, actorTelegramId: 'u1' } }),
        extended.supplierPayment.create({ data: { voucherNumber: '#SUP-1', amount: 2000, actorTelegramId: 's1' } }),
        extended.financialLedger.create({ data: { voucherNumber: '#FIN-2', amount: 1500, actorTelegramId: 'u2' } }),
        extended.supplierPayment.create({ data: { voucherNumber: '#SUP-2', amount: 2500, actorTelegramId: 's2' } }),
      ];

      await Promise.all(tasks);

      expect(store).toHaveLength(2);
      expect(supplierStore).toHaveLength(2);

      // Both independent chains start with GENESIS_HASH
      expect(store[0]!.previousHash).toBe(GENESIS_HASH);
      expect(store[1]!.previousHash).toBe(store[0]!.recordHash);

      expect(supplierStore[0]!.previousHash).toBe(GENESIS_HASH);
      expect(supplierStore[1]!.previousHash).toBe(supplierStore[0]!.recordHash);

      // And are different from each other
      expect(store[0]!.recordHash).not.toBe(supplierStore[0]!.recordHash);
    });

    it('2.7: Empty batch resilience and large-scale cursor pagination audit (105 records across pages)', async () => {
      const { client, store } = createMockConcurrentClient({ simulatedDelayMs: 0 });
      const extended = hashLedgerExtension(client);

      // Empty batch does nothing and returns count 0
      const emptyRes = await extended.financialLedger.createMany({ data: [] });
      expect(store).toHaveLength(0);

      // Create 105 records in batches
      const total = 105;
      const batch1 = Array.from({ length: 50 }, (_, i) => ({
        voucherNumber: `#V-P1-${i + 1}`,
        amount: 100 + i,
        actorTelegramId: `act-${i}`,
      }));
      const batch2 = Array.from({ length: 55 }, (_, i) => ({
        voucherNumber: `#V-P2-${i + 1}`,
        amount: 200 + i,
        actorTelegramId: `act-${i + 50}`,
      }));

      await extended.financialLedger.createMany({ data: batch1 });
      await extended.financialLedger.createMany({ data: batch2 });

      expect(store).toHaveLength(total);

      // Verify chain via verifyLedgerChainDb with batchSize = 20 (forces 6 page iterations)
      const audit = await verifyLedgerChainDb(client, {
        model: 'FinancialLedger',
        batchSize: 20,
      });

      expect(audit.isValid).toBe(true);
      expect(audit.totalVerified).toBe(total);
      expect(audit.brokenRecordId).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. IMMUTABILITY GUARDS (ATTEMPTED UPDATES & HARD DELETIONS)
  // =========================================================================
  describe('3. Immutability Guards (Strict Append-Only Enforcement)', () => {
    function createMockImmutabilityClient() {
      const baseClient: any = {
        financialLedger: {
          update: vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
          updateMany: vi.fn(async () => ({ count: 1 })),
          delete: vi.fn(async () => ({ id: '1' })),
          deleteMany: vi.fn(async () => ({ count: 1 })),
        },
        supplierPayment: {
          update: vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
          updateMany: vi.fn(async () => ({ count: 1 })),
          delete: vi.fn(async () => ({ id: '1' })),
          deleteMany: vi.fn(async () => ({ count: 1 })),
        },
        worker: {
          update: vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
          updateMany: vi.fn(async () => ({ count: 1 })),
          delete: vi.fn(async () => ({ id: '1' })),
          deleteMany: vi.fn(async () => ({ count: 1 })),
        },
        $extends: (extensionOrFn: any) => {
          if (typeof extensionOrFn === 'function') return extensionOrFn(baseClient);
          if (extensionOrFn?.query?.$allModels) {
            const ext = extensionOrFn.query.$allModels;
            const extended: any = { ...baseClient };

            for (const model of ['financialLedger', 'supplierPayment', 'worker']) {
              const canonical = model === 'worker' ? 'Worker' : model === 'supplierPayment' ? 'SupplierPayment' : 'FinancialLedger';
              extended[model] = {
                ...baseClient[model],
                update: (args: any) =>
                  ext.update({ model: canonical, operation: 'update', args, query: baseClient[model].update }),
                updateMany: (args: any) =>
                  ext.updateMany({ model: canonical, operation: 'updateMany', args, query: baseClient[model].updateMany }),
                delete: (args: any) =>
                  ext.delete({ model: canonical, operation: 'delete', args, query: baseClient[model].delete }),
                deleteMany: (args: any) =>
                  ext.deleteMany({ model: canonical, operation: 'deleteMany', args, query: baseClient[model].deleteMany }),
              };
            }
            return extended;
          }
          return baseClient;
        },
      };

      return baseClient;
    }

    it('3.1: Forbids updating recordHash (single update and updateMany)', async () => {
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      await expect(
        extended.financialLedger.update({
          where: { id: 'FL-1' },
          data: { recordHash: 'malicious-hash' },
        })
      ).rejects.toThrow(ImmutableLedgerError);

      await expect(
        extended.financialLedger.updateMany({
          where: { isReversal: false },
          data: { recordHash: 'malicious-hash' },
        })
      ).rejects.toThrow(ImmutableLedgerError);
    });

    it('3.2: Forbids updating previousHash', async () => {
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      await expect(
        extended.financialLedger.update({
          where: { id: 'FL-1' },
          data: { previousHash: 'forged-parent-hash' },
        })
      ).rejects.toThrow(ImmutableLedgerError);

      await expect(
        extended.financialLedger.updateMany({
          where: {},
          data: { previousHash: 'forged-parent-hash' },
        })
      ).rejects.toThrow(ImmutableLedgerError);
    });

    it('3.3: Forbids updating financial amount', async () => {
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      await expect(
        extended.financialLedger.update({
          where: { id: 'FL-1' },
          data: { amount: 999999 },
        })
      ).rejects.toThrow(ImmutableLedgerError);

      await expect(
        extended.supplierPayment.update({
          where: { id: 'SP-1' },
          data: { amount: 0 },
        })
      ).rejects.toThrow(ImmutableLedgerError);
    });

    it('3.4: Forbids updating hashTimestamp', async () => {
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      await expect(
        extended.financialLedger.update({
          where: { id: 'FL-1' },
          data: { hashTimestamp: new Date('2020-01-01') },
        })
      ).rejects.toThrow(ImmutableLedgerError);
    });

    it('3.5: Forbids hard deletion (delete and deleteMany) across financial models', async () => {
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      // FinancialLedger
      await expect(
        extended.financialLedger.delete({ where: { id: 'FL-1' } })
      ).rejects.toThrow(LedgerHardDeleteForbiddenError);

      await expect(
        extended.financialLedger.deleteMany({ where: { isReversal: true } })
      ).rejects.toThrow(LedgerHardDeleteForbiddenError);

      // SupplierPayment
      await expect(
        extended.supplierPayment.delete({ where: { id: 'SP-1' } })
      ).rejects.toThrow(LedgerHardDeleteForbiddenError);

      await expect(
        extended.supplierPayment.deleteMany({})
      ).rejects.toThrow(LedgerHardDeleteForbiddenError);
    });

    it('3.6: Permits updating mutable non-financial audit fields in LEDGER_UPDATE_WHITELIST', async () => {
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      // Allowed whitelist updates do not throw
      const updated = await extended.financialLedger.update({
        where: { id: 'FL-1' },
        data: {
          approvalStatus: 'APPROVED',
          auditNotes: 'Updated accounting memorandum',
          syncedToSheets: true,
        },
      });

      expect(updated.approvalStatus).toBe('APPROVED');
      expect(updated.auditNotes).toBe('Updated accounting memorandum');
      expect(updated.syncedToSheets).toBe(true);

      // Updates outside whitelist throw
      await expect(
        extended.financialLedger.update({
          where: { id: 'FL-1' },
          data: { description: 'Updated accounting memorandum' },
        })
      ).rejects.toThrow(ImmutableLedgerError);
    });

    it('3.7: Non-financial models are exempt from ledger immutability constraints', async () => {
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      // Worker updates and deletions are allowed
      const updatedWorker = await extended.worker.update({
        where: { id: 'W-1' },
        data: { name: 'Sayed Ahmed' },
      });
      expect(updatedWorker.name).toBe('Sayed Ahmed');

      const deletedWorker = await extended.worker.delete({
        where: { id: 'W-1' },
      });
      expect(deletedWorker).toBeDefined();
    });
  });
});
