import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { PINNED_BASE_TIME } from '../../shared/src/testing/pinned-clock.js';
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
import {
  isPortOpen,
  DEFAULT_POSTGRES_HOST,
  DEFAULT_POSTGRES_PORT,
  setupTestDatabase,
  getTestDatabaseUrl,
} from '../../../scripts/test-db-setup.js';
import { createExtendedPrismaClient } from '../src/client.js';

const isLive = await isPortOpen(DEFAULT_POSTGRES_HOST, DEFAULT_POSTGRES_PORT);

describe('Adversarial Challenge M2.1: Cryptographic Hash-Chain & Concurrency Stress Suite', () => {
  // =========================================================================
  // 1. HASH CALCULATION DETERMINISM & CANONICAL FORMULA EDGE CASES
  // =========================================================================
  describe('1. Hash Calculation Determinism & Canonical Formula Edge Cases', () => {
    it('1.1: computes identical SHA-256 hash across 1,000 consecutive iterations with exact 64-hex-character length', () => {
      // Arrange
      const payload = {
        previousHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
        model: 'FinancialLedger',
        amount: 1250.75,
        actorId: 'user_9988',
        timestamp: new Date('2026-09-11T12:30:00.000Z'),
      };

      // Act
      const baseline = computeRecordHash(payload);

      // Assert
      expect(baseline).toHaveLength(64);
      expect(baseline).not.toContain('undefined');
      expect(baseline).not.toBe(GENESIS_HASH);

      for (let i = 0; i < 1000; i++) {
        const hash = computeRecordHash(payload);
        expect(hash).toBe(baseline);
      }
    });

    it('1.2: formats negative financial amounts with deterministic two-decimal precision for reversal accounting entries', () => {
      // Arrange
      const ts = '2026-09-11T12:00:00.000Z';
      const expectedString = `${GENESIS_HASH}::FinancialLedger:-500.50:EGP::::reversal-actor:${ts}`;
      const expectedHash = crypto.createHash('sha256').update(expectedString).digest('hex');
      const expectedMicro = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::FinancialLedger:-0.01:EGP::::reversal-actor:${ts}`)
        .digest('hex');

      // Act
      const hashNegNum = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: -500.5,
        actorId: 'reversal-actor',
        timestamp: ts,
      });

      const hashNegStr = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: '-500.50',
        actorId: 'reversal-actor',
        timestamp: ts,
      });

      const hashMicroNeg = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: -0.01,
        actorId: 'reversal-actor',
        timestamp: ts,
      });

      // Assert
      expect(hashNegNum).toBe(expectedHash);
      expect(hashNegStr).toBe(expectedHash);
      expect(hashMicroNeg).toBe(expectedMicro);
      expect(hashNegNum).toHaveLength(64);
      expect(hashNegNum).not.toContain('undefined');
      expect(hashNegNum).not.toBe(GENESIS_HASH);
      expect(hashMicroNeg).not.toBe(hashNegNum);
    });

    it('1.3: normalizes zero, float zero, and negative zero to identical canonical 0.00 currency representations', () => {
      // Arrange
      const ts = '2026-09-11T12:00:00.000Z';
      const expectedZeroHash = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::CustodySettlement:0.00:EGP::::sys-settle:${ts}`)
        .digest('hex');

      // Act
      const hashIntZero = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'CustodySettlement',
        amount: 0,
        actorId: 'sys-settle',
        timestamp: ts,
      });

      const hashFloatZero = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'CustodySettlement',
        amount: 0.0,
        actorId: 'sys-settle',
        timestamp: ts,
      });

      const hashStrZero = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'CustodySettlement',
        amount: '0',
        actorId: 'sys-settle',
        timestamp: ts,
      });

      const hashStrDecZero = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'CustodySettlement',
        amount: '0.00',
        actorId: 'sys-settle',
        timestamp: ts,
      });

      const hashNegZero = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'CustodySettlement',
        amount: -0,
        actorId: 'sys-settle',
        timestamp: ts,
      });

      const hashNegZeroStr = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'CustodySettlement',
        amount: '-0',
        actorId: 'sys-settle',
        timestamp: ts,
      });

      // Assert
      expect(hashIntZero).toBe(expectedZeroHash);
      expect(hashFloatZero).toBe(expectedZeroHash);
      expect(hashStrZero).toBe(expectedZeroHash);
      expect(hashStrDecZero).toBe(expectedZeroHash);
      expect(hashNegZero).toBe(expectedZeroHash);
      expect(hashNegZeroStr).toBe(expectedZeroHash);
      expect(expectedZeroHash).toHaveLength(64);
      expect(expectedZeroHash).not.toContain('undefined');
      expect(expectedZeroHash).not.toBe(GENESIS_HASH);
    });

    it('1.4: applies deterministic half-up rounding on sub-cent amounts to ensure canonical two-decimal representation', () => {
      // Arrange
      const ts = '2026-09-11T12:00:00.000Z';
      const expectedUp = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::SupplierPayment:100.46:EGP::::procurement:${ts}`)
        .digest('hex');
      const expectedDown = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::SupplierPayment:100.45:EGP::::procurement:${ts}`)
        .digest('hex');
      const expectedSubLow = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::SupplierPayment:0.00:EGP::::procurement:${ts}`)
        .digest('hex');
      const expectedSubHigh = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::SupplierPayment:0.01:EGP::::procurement:${ts}`)
        .digest('hex');

      // Act
      const hashRoundUp = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'SupplierPayment',
        amount: 100.456789,
        actorId: 'procurement',
        timestamp: ts,
      });

      const hashRoundDown = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'SupplierPayment',
        amount: 100.454321,
        actorId: 'procurement',
        timestamp: ts,
      });

      const hashSubCentLow = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'SupplierPayment',
        amount: 0.004,
        actorId: 'procurement',
        timestamp: ts,
      });

      const hashSubCentHigh = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'SupplierPayment',
        amount: 0.006,
        actorId: 'procurement',
        timestamp: ts,
      });

      // Assert
      expect(hashRoundUp).toBe(expectedUp);
      expect(hashRoundDown).toBe(expectedDown);
      expect(hashSubCentLow).toBe(expectedSubLow);
      expect(hashSubCentHigh).toBe(expectedSubHigh);
      expect(hashRoundUp).not.toBe(hashRoundDown);
      expect(hashSubCentLow).not.toBe(hashSubCentHigh);
      expect(hashRoundUp).toHaveLength(64);
      expect(hashRoundUp).not.toContain('undefined');
    });

    it('1.5: preserves UTF-8 integrity across Arabic text, emoji sequences, and URI colons in actor identifiers', () => {
      // Arrange
      const ts = '2026-09-11T14:00:00.000Z';
      const arabicActor = 'المشرف_أحمد_السيد_٩٩';
      const emojiActor = '👷_Admin_👑_خزينة_💰';
      const colonActor = 'urn:alsaada:actor:role:accountant:42';

      const expectedArabic = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::FinancialLedger:500.00:EGP::::${arabicActor}:${ts}`)
        .digest('hex');

      const expectedEmoji = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::FinancialLedger:750.00:EGP::::${emojiActor}:${ts}`)
        .digest('hex');

      const expectedColon = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::FinancialLedger:1000.00:EGP::::${colonActor}:${ts}`)
        .digest('hex');

      // Act
      const hashArabic = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: 500,
        actorId: arabicActor,
        timestamp: ts,
      });

      const hashEmoji = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: 750,
        actorId: emojiActor,
        timestamp: ts,
      });

      const hashColon = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: 1000,
        actorId: colonActor,
        timestamp: ts,
      });

      // Assert
      expect(hashArabic).toBe(expectedArabic);
      expect(hashEmoji).toBe(expectedEmoji);
      expect(hashColon).toBe(expectedColon);
      expect(hashArabic).not.toBe(hashEmoji);
      expect(hashArabic).not.toBe(hashColon);
      expect(hashArabic).not.toContain('undefined');
      expect(hashEmoji).toHaveLength(64);
    });

    it('1.6: normalizes camelCase and PascalCase model names to canonical PascalCase identifier', () => {
      // Arrange
      const camelFin = 'financialLedger';
      const pascalFin = 'FinancialLedger';
      const camelSup = 'supplierPayment';
      const pascalSup = 'SupplierPayment';

      // Act
      const normCamelFin = normalizeModelName(camelFin);
      const normPascalFin = normalizeModelName(pascalFin);
      const normCamelSup = normalizeModelName(camelSup);
      const normPascalSup = normalizeModelName(pascalSup);

      // Assert
      expect(normCamelFin).toBe('FinancialLedger');
      expect(normPascalFin).toBe('FinancialLedger');
      expect(normCamelSup).toBe('SupplierPayment');
      expect(normPascalSup).toBe('SupplierPayment');
      expect(normCamelFin).not.toBe('financialLedger');
      expect(normCamelSup).not.toBe('supplierPayment');
    });

    it('1.7: extracts numeric values across amount aliases including strings, invoice totals, and empty payloads', () => {
      // Arrange
      const numObj = { amount: 1200 };
      const strObj = { amount: '450.50' };
      const closingObj = { closingTotalInvoices: 3200 };
      const cashObj = { remainingCashReturned: 800 };
      const emptyObj = {};

      // Act
      const numVal = extractAmount(numObj);
      const strVal = extractAmount(strObj);
      const closingVal = extractAmount(closingObj);
      const cashVal = extractAmount(cashObj);
      const emptyVal = extractAmount(emptyObj);

      // Assert
      expect(numVal).toBe(1200);
      expect(strVal).toBe(450.5);
      expect(closingVal).toBe(3200);
      expect(cashVal).toBe(800);
      expect(emptyVal).toBe(0);
      expect(emptyVal).not.toBeNaN();
      expect(strVal).not.toBe(450);
    });

    it('1.8: prioritizes actor identification fields deterministically and defaults to system when unassigned', () => {
      // Arrange
      const multiActor = { actorTelegramId: '111', actorId: '222' };
      const singleActor = { actorId: '222' };
      const recordedBy = { recordedByUserId: 333 };
      const auditedBy = { auditedByUserId: 444 };
      const approvedBy = { approvedByUserId: 555 };
      const disbursedBy = { disbursedByWorkerId: 'w1' };
      const worker = { workerId: 'w2' };
      const custody = { custodyId: 'c1' };
      const supplier = { supplierId: 's1' };
      const empty = {};

      // Act
      const actMulti = extractActorId(multiActor);
      const actSingle = extractActorId(singleActor);
      const actRec = extractActorId(recordedBy);
      const actAud = extractActorId(auditedBy);
      const actApp = extractActorId(approvedBy);
      const actDisb = extractActorId(disbursedBy);
      const actWorker = extractActorId(worker);
      const actCustody = extractActorId(custody);
      const actSupplier = extractActorId(supplier);
      const actEmpty = extractActorId(empty);

      // Assert
      expect(actMulti).toBe('111');
      expect(actSingle).toBe('222');
      expect(actRec).toBe('333');
      expect(actAud).toBe('444');
      expect(actApp).toBe('555');
      expect(actDisb).toBe('w1');
      expect(actWorker).toBe('w2');
      expect(actCustody).toBe('c1');
      expect(actSupplier).toBe('s1');
      expect(actEmpty).toBe('system');
      expect(actMulti).not.toBe('222');
      expect(actEmpty).not.toBe('');
    });

    it('1.9: converts BigInt Telegram identifiers beyond MAX_SAFE_INTEGER to deterministic string representation in record hash', () => {
      // Arrange
      const ts = '2026-09-11T12:00:00.000Z';
      const bigIntActor = 9007199254740993n; // Greater than Number.MAX_SAFE_INTEGER
      const expected = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::FinancialLedger:250.00:EGP::::9007199254740993:${ts}`)
        .digest('hex');

      // Act
      const hash = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: 250,
        actorId: bigIntActor,
        timestamp: ts,
      });
      const extractedId = extractActorId({ actorTelegramId: bigIntActor });

      // Assert
      expect(hash).toBe(expected);
      expect(extractedId).toBe('9007199254740993');
      expect(hash).toHaveLength(64);
      expect(hash).not.toContain('undefined');
      expect(extractedId).not.toBe('system');
    });

    it('1.10: coerces Prisma Decimal objects seamlessly into float numbers and canonical hash strings', () => {
      // Arrange
      const ts = '2026-09-11T12:00:00.000Z';
      const prismaDecimal = {
        valueOf: () => '1850.25',
        toString: () => '1850.25',
        [Symbol.toPrimitive]: () => 1850.25,
      };
      const expected = crypto
        .createHash('sha256')
        .update(`${GENESIS_HASH}::FinancialLedger:1850.25:EGP::::dec-actor:${ts}`)
        .digest('hex');

      // Act
      const extracted = extractAmount({ amount: prismaDecimal });
      const hash = computeRecordHash({
        previousHash: GENESIS_HASH,
        model: 'FinancialLedger',
        amount: prismaDecimal as any,
        actorId: 'dec-actor',
        timestamp: ts,
      });

      // Assert
      expect(extracted).toBe(1850.25);
      expect(hash).toBe(expected);
      expect(hash).toHaveLength(64);
      expect(hash).not.toContain('undefined');
      expect(extracted).not.toBeNaN();
    });

    it('1.11: produces identical hash digest when timestamp is provided as Date instance or ISO 8601 string', () => {
      // Arrange
      const date = new Date('2026-09-11T16:45:30.123Z');
      const isoStr = '2026-09-11T16:45:30.123Z';

      // Act
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

      // Assert
      expect(hashDate).toBe(hashStr);
      expect(hashDate).toHaveLength(64);
      expect(hashDate).not.toContain('undefined');
      expect(hashDate).not.toBe(GENESIS_HASH);
    });
  });

  // =========================================================================
  // 2. CONCURRENCY SAFETY & BATCH INSERTION CHAINING (createMany)
  // =========================================================================
  describe('2. Concurrency Safety & Batch Insertion Chaining', () => {
    const PINNED_MOCK_BASE = new Date('2026-09-11T10:00:00.000Z');

    function createMockConcurrentClient(options: { simulatedDelayMs?: number } = {}) {
      const store: Record<string, any>[] = [];
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const mockDelegate = {
        findFirst: vi.fn(async ({ orderBy, select }) => {
          const delay = ((store.length % 3) + 1) * 2;
          await sleep(delay);
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
          const delay = ((store.length % 3) + 1) * 2;
          await sleep(delay);
          const id = `REC-${store.length + 1}`;
          const createdAt = new Date(PINNED_MOCK_BASE.getTime() + store.length * 1000);
          const record = { id, createdAt, ...data };
          store.push(record);
          return record;
        }),
        createMany: vi.fn(async ({ data }) => {
          const delay = ((store.length % 3) + 1) * 2;
          await sleep(delay);
          const arr = Array.isArray(data) ? data : [data];
          for (const item of arr) {
            const id = `REC-${store.length + 1}`;
            const createdAt = new Date(PINNED_MOCK_BASE.getTime() + store.length * 1000);
            store.push({ id, createdAt, ...item });
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
          const delay = ((supplierStore.length % 3) + 1) * 2;
          await sleep(delay);
          if (supplierStore.length === 0) return null;
          return { recordHash: supplierStore[supplierStore.length - 1]!.recordHash };
        }),
        findMany: vi.fn(async () => [...supplierStore]),
        create: vi.fn(async ({ data }) => {
          const delay = ((supplierStore.length % 3) + 1) * 2;
          await sleep(delay);
          const id = `SUP-${supplierStore.length + 1}`;
          const createdAt = new Date(PINNED_MOCK_BASE.getTime() + supplierStore.length * 1000);
          const record = { id, createdAt, ...data };
          supplierStore.push(record);
          return record;
        }),
        createMany: vi.fn(async ({ data }) => {
          const arr = Array.isArray(data) ? data : [data];
          for (const item of arr) {
            const id = `SUP-${supplierStore.length + 1}`;
            const createdAt = new Date(PINNED_MOCK_BASE.getTime() + supplierStore.length * 1000);
            supplierStore.push({ id, createdAt, ...item });
          }
          return { count: arr.length };
        }),
        update: vi.fn(async ({ where, data }: any) => ({ ...supplierStore[0], ...data })),
        updateMany: vi.fn(async ({ where, data }: any) => ({ count: 1 })),
        delete: vi.fn(async () => supplierStore.pop()),
        deleteMany: vi.fn(async () => ({ count: supplierStore.length })),
      };

      let advisoryLock = Promise.resolve();
      let releaseActiveLock: (() => void) | null = null;

      const client: any = {
        $executeRawUnsafe: vi.fn(async (sql: string) => {
          if (typeof sql === 'string' && sql.includes('pg_advisory_xact_lock')) {
            let nextRelease: () => void;
            const nextPromise = new Promise<void>((resolve) => {
              nextRelease = resolve;
            });
            const wait = advisoryLock;
            advisoryLock = advisoryLock.then(() => nextPromise);
            await wait;
            releaseActiveLock = nextRelease!;
          }
        }),
        $queryRawUnsafe: vi.fn(async (sql: string) => {
          if (typeof sql === 'string' && sql.includes('COALESCE(MAX(ledger_seq)')) {
            const maxSeq = store.reduce(
              (max, r) => (r.ledgerSeq && BigInt(r.ledgerSeq) > max ? BigInt(r.ledgerSeq) : max),
              0n
            );
            return [{ next_seq: maxSeq + 1n }];
          }
          return [];
        }),
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
                try {
                  return await ext.create({
                    model: 'FinancialLedger',
                    operation: 'create',
                    args,
                    query: mockDelegate.create,
                  });
                } finally {
                  if (releaseActiveLock) {
                    const r = releaseActiveLock;
                    releaseActiveLock = null;
                    r();
                  }
                }
              },
              createMany: async (args: any) => {
                try {
                  return await ext.createMany({
                    model: 'FinancialLedger',
                    operation: 'createMany',
                    args,
                    query: mockDelegate.createMany,
                  });
                } finally {
                  if (releaseActiveLock) {
                    const r = releaseActiveLock;
                    releaseActiveLock = null;
                    r();
                  }
                }
              },
              update: async (args: any) =>
                ext.update({ model: 'FinancialLedger', operation: 'update', args, query: mockDelegate.update }),
              updateMany: async (args: any) =>
                ext.updateMany({ model: 'FinancialLedger', operation: 'updateMany', args, query: mockDelegate.updateMany }),
              delete: async (args: any) =>
                ext.delete({ model: 'FinancialLedger', operation: 'delete', args, query: mockDelegate.delete }),
              deleteMany: async (args: any) =>
                ext.deleteMany({ model: 'FinancialLedger', operation: 'deleteMany', args, query: mockDelegate.deleteMany }),
            };

            extended.supplierPayment = {
              ...mockSupplierDelegate,
              create: async (args: any) => {
                try {
                  return await ext.create({
                    model: 'SupplierPayment',
                    operation: 'create',
                    args,
                    query: mockSupplierDelegate.create,
                  });
                } finally {
                  if (releaseActiveLock) {
                    const r = releaseActiveLock;
                    releaseActiveLock = null;
                    r();
                  }
                }
              },
              createMany: async (args: any) => {
                try {
                  return await ext.createMany({
                    model: 'SupplierPayment',
                    operation: 'createMany',
                    args,
                    query: mockSupplierDelegate.createMany,
                  });
                } finally {
                  if (releaseActiveLock) {
                    const r = releaseActiveLock;
                    releaseActiveLock = null;
                    r();
                  }
                }
              },
              update: async (args: any) =>
                ext.update({ model: 'SupplierPayment', operation: 'update', args, query: mockSupplierDelegate.update }),
              updateMany: async (args: any) =>
                ext.updateMany({ model: 'SupplierPayment', operation: 'updateMany', args, query: mockSupplierDelegate.updateMany }),
              delete: async (args: any) =>
                ext.delete({ model: 'SupplierPayment', operation: 'delete', args, query: mockSupplierDelegate.delete }),
              deleteMany: async (args: any) =>
                ext.deleteMany({ model: 'SupplierPayment', operation: 'deleteMany', args, query: mockSupplierDelegate.deleteMany }),
            };

            return extended;
          }
          return client;
        },
      };

      return { client, store, supplierStore, mockDelegate };
    }

    it('2.1: serializes 50 concurrent mutations into an unbroken chain with gap-free sequence monotonicity', async () => {
      // Arrange
      const { client, store } = createMockConcurrentClient({ simulatedDelayMs: 4 });
      const extended = hashLedgerExtension(client);
      const N = 50;

      const tasks = Array.from({ length: N }, (_, i) => {
        return extended.financialLedger.create({
          data: {
            voucherNumber: `#ADV-CONCUR-${i + 1}`,
            amount: 100 * (i + 1),
            actorTelegramId: `actor-${i + 1}`,
            hashTimestamp: new Date(`2026-09-11T10:${i < 10 ? '0' + i : (i < 60 ? i : 59)}:00.000Z`),
          },
        });
      });

      // Act
      await Promise.all(tasks);

      // Assert
      // Pillar 1: Exact cardinality
      expect(store).toHaveLength(N);

      // Pillar 2: Strict gap-free monotonicity [1, 2, ..., 50]
      const sequences = store.map((r) => Number(r.ledgerSeq));
      for (let i = 0; i < N; i++) {
        expect(sequences[i]).toBe(i + 1);
      }

      // Pillar 3: Strict cryptographic lineage (zero forks)
      const previousHashes = store.map((r) => r.previousHash);
      const uniquePrevHashes = new Set(previousHashes);
      expect(uniquePrevHashes.size).toBe(N);
      expect(uniquePrevHashes.size).not.toBeLessThan(N);

      expect(store[0]!.previousHash).toBe(GENESIS_HASH);
      for (let i = 1; i < N; i++) {
        expect(store[i]!.previousHash).toBe(store[i - 1]!.recordHash);
      }

      // Pillar 4: HMAC signature verification
      for (const r of store) {
        expect(r.hmacKid).toBe('v1-2026-q1');
        expect(r.hmacSignature).toBeDefined();
        expect(r.hmacSignature).toHaveLength(64);
        expect(r.hmacSignature).not.toBe('');
      }

      // Out-of-band direct database probe verification
      const report = await verifyLedgerChainDb(client, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(true);
      expect(report.totalVerified).toBe(N);
      expect(report.brokenRecordId).toBeUndefined();
      expect(report.error).toBeUndefined();
    });

    it('2.2: chains 50 batch records sequentially in a single createMany operation with cryptographic lineage', async () => {
      // Arrange
      const { client, store } = createMockConcurrentClient();
      const extended = hashLedgerExtension(client);
      const batchCount = 50;

      const items = Array.from({ length: batchCount }, (_, i) => ({
        voucherNumber: `#BATCH-01-${i + 1}`,
        amount: 250 + i * 10,
        actorTelegramId: `batch-user-${i}`,
        hashTimestamp: new Date(`2026-09-11T11:00:${i < 10 ? '0' + i : i}.000Z`),
      }));

      // Act
      await extended.financialLedger.createMany({ data: items });

      // Assert
      expect(store).toHaveLength(batchCount);
      expect(store[0]!.previousHash).toBe(GENESIS_HASH);
      expect(store[0]!.previousHash).not.toBe(store[1]!.previousHash);

      for (let i = 1; i < batchCount; i++) {
        expect(store[i]!.previousHash).toBe(store[i - 1]!.recordHash);
      }

      const report = await verifyLedgerChainDb(client, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(true);
      expect(report.totalVerified).toBe(batchCount);
      expect(report.brokenRecordId).toBeUndefined();
      expect(report.isValid).not.toBe(false);
    });

    it('2.3: serializes multiple concurrent createMany batches into a unified continuous cryptographic chain', async () => {
      // Arrange
      const { client, store } = createMockConcurrentClient({ simulatedDelayMs: 6 });
      const extended = hashLedgerExtension(client);
      const numBatches = 4;
      const itemsPerBatch = 5;
      const totalRecords = numBatches * itemsPerBatch;

      const batchPromises = Array.from({ length: numBatches }, (_, b) => {
        const batchItems = Array.from({ length: itemsPerBatch }, (_, i) => ({
          voucherNumber: `#CONCUR-BATCH-${b + 1}-${i + 1}`,
          amount: (b + 1) * 1000 + (i + 1) * 10,
          actorTelegramId: `batch-actor-${b}`,
          hashTimestamp: new Date(`2026-09-11T12:${b}${i}:00.000Z`),
        }));
        return extended.financialLedger.createMany({ data: batchItems });
      });

      // Act
      await Promise.all(batchPromises);

      // Assert
      expect(store).toHaveLength(totalRecords);
      expect(store[0]!.previousHash).toBe(GENESIS_HASH);

      for (let i = 1; i < totalRecords; i++) {
        expect(store[i]!.previousHash).toBe(store[i - 1]!.recordHash);
      }

      const report = await verifyLedgerChainDb(client, { model: 'FinancialLedger' });
      expect(report.isValid).toBe(true);
      expect(report.totalVerified).toBe(totalRecords);
      expect(report.isValid).not.toBe(false);
      expect(report.brokenRecordId).toBeUndefined();
    });

    it('maintains unbroken sequential continuity when interleaving concurrent single creates and batch insertions', async () => {
      // Arrange
      const { client, store } = createMockConcurrentClient({ simulatedDelayMs: 5 });
      const extended = hashLedgerExtension(client);

      const single1 = extended.financialLedger.create({
        data: {
          voucherNumber: '#SINGLE-1',
          amount: 100,
          actorTelegramId: 's1',
          hashTimestamp: new Date('2026-09-11T13:00:00Z'),
        },
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
        data: {
          voucherNumber: '#SINGLE-2',
          amount: 300,
          actorTelegramId: 's2',
          hashTimestamp: new Date('2026-09-11T13:05:00Z'),
        },
      });
      const batch2 = extended.financialLedger.createMany({
        data: [
          { voucherNumber: '#B2-1', amount: 401, actorTelegramId: 'b2', hashTimestamp: new Date('2026-09-11T13:06:00Z') },
          { voucherNumber: '#B2-2', amount: 402, actorTelegramId: 'b2', hashTimestamp: new Date('2026-09-11T13:07:00Z') },
        ],
      });

      // Act
      await Promise.all([single1, batch1, single2, batch2]);

      // Assert
      expect(store).toHaveLength(8);
      expect(store[0]!.previousHash).toBe(GENESIS_HASH);
      expect(store[0]!.previousHash).not.toBe(store[1]!.previousHash);

      for (let i = 1; i < store.length; i++) {
        expect(store[i]!.previousHash).toBe(store[i - 1]!.recordHash);
      }

      expect(store[7]!.recordHash).not.toContain('undefined');
      await assertLedgerChainIntegrity(client, { model: 'FinancialLedger' });
    });

    it('2.5: releases concurrency lock on mutation error allowing subsequent transactions to succeed without deadlock', async () => {
      // Arrange
      const { client, store, mockDelegate } = createMockConcurrentClient();
      const extended = hashLedgerExtension(client);

      // Act & Assert 1: First record succeeds
      await extended.financialLedger.create({
        data: { voucherNumber: '#V-01', amount: 100, actorTelegramId: 'u1' },
      });
      expect(store).toHaveLength(1);

      // Act & Assert 2: Second record deliberately fails inside query (e.g. database error)
      mockDelegate.create.mockRejectedValueOnce(new Error('Simulated unique constraint error'));

      await expect(
        extended.financialLedger.create({
          data: { voucherNumber: '#V-02-FAIL', amount: 200, actorTelegramId: 'u2' },
        })
      ).rejects.toThrow('Simulated unique constraint error');

      // Act & Assert 3: Third record MUST succeed immediately (proving mutex lock was freed in finally)
      const rec3 = await extended.financialLedger.create({
        data: { voucherNumber: '#V-03-SUCCESS', amount: 300, actorTelegramId: 'u3' },
      });

      expect(store).toHaveLength(2);
      expect(rec3.previousHash).toBe(store[0]!.recordHash);
      expect(rec3.recordHash).not.toBe(store[0]!.recordHash);
      expect(rec3.previousHash).not.toBe(GENESIS_HASH);
    });

    it('2.6: isolates hash chains across independent financial models without cross-model contention or corruption', async () => {
      // Arrange
      const { client, store, supplierStore } = createMockConcurrentClient({ simulatedDelayMs: 5 });
      const extended = hashLedgerExtension(client);

      const tasks = [
        extended.financialLedger.create({ data: { voucherNumber: '#FIN-1', amount: 1000, actorTelegramId: 'u1' } }),
        extended.supplierPayment.create({ data: { voucherNumber: '#SUP-1', amount: 2000, actorTelegramId: 's1' } }),
        extended.financialLedger.create({ data: { voucherNumber: '#FIN-2', amount: 1500, actorTelegramId: 'u2' } }),
        extended.supplierPayment.create({ data: { voucherNumber: '#SUP-2', amount: 2500, actorTelegramId: 's2' } }),
      ];

      // Act
      await Promise.all(tasks);

      // Assert
      expect(store).toHaveLength(2);
      expect(supplierStore).toHaveLength(2);

      // Both independent chains start with GENESIS_HASH
      expect(store[0]!.previousHash).toBe(GENESIS_HASH);
      expect(store[1]!.previousHash).toBe(store[0]!.recordHash);

      expect(supplierStore[0]!.previousHash).toBe(GENESIS_HASH);
      expect(supplierStore[1]!.previousHash).toBe(supplierStore[0]!.recordHash);

      // And are different from each other
      expect(store[0]!.recordHash).not.toBe(supplierStore[0]!.recordHash);
      expect(store[1]!.recordHash).not.toBe(supplierStore[1]!.recordHash);
      expect(store[0]!.previousHash).not.toBeNull();
      expect(supplierStore[0]!.previousHash).not.toBeNull();
    });

    it('2.7: verifies large multi-page cursor pagination across 105 records while handling empty batch gracefully', async () => {
      // Arrange
      const { client, store } = createMockConcurrentClient({ simulatedDelayMs: 0 });
      const extended = hashLedgerExtension(client);
      const total = 105;

      // Act 1: Empty batch does nothing and returns count 0
      const emptyRes = await extended.financialLedger.createMany({ data: [] });

      // Assert 1
      expect(store).toHaveLength(0);
      expect(emptyRes.count).toBe(0);

      // Act 2: Create 105 records in batches
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

      // Assert 2
      expect(store).toHaveLength(total);

      // Verify chain via verifyLedgerChainDb with batchSize = 20 (forces 6 page iterations)
      const audit = await verifyLedgerChainDb(client, {
        model: 'FinancialLedger',
        batchSize: 20,
      });

      expect(audit.isValid).toBe(true);
      expect(audit.totalVerified).toBe(total);
      expect(audit.brokenRecordId).toBeUndefined();
      expect(audit.isValid).not.toBe(false);
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
              const canonical =
                model === 'worker' ? 'Worker' : model === 'supplierPayment' ? 'SupplierPayment' : 'FinancialLedger';
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

    it('3.1: rejects updates targeting recordHash in single and bulk update mutations with ImmutableLedgerError', async () => {
      // Arrange
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      // Act
      const singleUpdatePromise = extended.financialLedger.update({
        where: { id: 'FL-1' },
        data: { recordHash: 'malicious-hash' },
      });
      const bulkUpdatePromise = extended.financialLedger.updateMany({
        where: { isReversal: false },
        data: { recordHash: 'malicious-hash' },
      });

      // Assert
      await expect(singleUpdatePromise).rejects.toThrow(ImmutableLedgerError);
      await expect(bulkUpdatePromise).rejects.toThrow(ImmutableLedgerError);
      await expect(singleUpdatePromise).rejects.not.toThrow(RangeError);
    });

    it('3.2: rejects updates targeting previousHash to prevent cryptographic chain reparenting', async () => {
      // Arrange
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      // Act
      const singleUpdatePromise = extended.financialLedger.update({
        where: { id: 'FL-1' },
        data: { previousHash: 'forged-parent-hash' },
      });
      const bulkUpdatePromise = extended.financialLedger.updateMany({
        where: {},
        data: { previousHash: 'forged-parent-hash' },
      });

      // Assert
      await expect(singleUpdatePromise).rejects.toThrow(ImmutableLedgerError);
      await expect(bulkUpdatePromise).rejects.toThrow(ImmutableLedgerError);
      await expect(singleUpdatePromise).rejects.not.toThrow(TypeError);
    });

    it('3.3: rejects financial amount modifications across financial models with ImmutableLedgerError', async () => {
      // Arrange
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      // Act
      const ledgerUpdatePromise = extended.financialLedger.update({
        where: { id: 'FL-1' },
        data: { amount: 999999 },
      });
      const supplierUpdatePromise = extended.supplierPayment.update({
        where: { id: 'SP-1' },
        data: { amount: 0 },
      });

      // Assert
      await expect(ledgerUpdatePromise).rejects.toThrow(ImmutableLedgerError);
      await expect(supplierUpdatePromise).rejects.toThrow(ImmutableLedgerError);
      await expect(ledgerUpdatePromise).rejects.not.toThrow(TypeError);
    });

    it('3.4: rejects hashTimestamp alterations to preserve chronological ledger immutability', async () => {
      // Arrange
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      // Act
      const updatePromise = extended.financialLedger.update({
        where: { id: 'FL-1' },
        data: { hashTimestamp: new Date('2020-01-01T00:00:00.000Z') },
      });
      const err = await updatePromise.catch((e: unknown) => e);

      // Assert
      expect(err).toBeInstanceOf(ImmutableLedgerError);
      expect((err as Error).message).toContain('hashTimestamp');
      expect(err).not.toBeInstanceOf(TypeError);
    });

    it('3.5: rejects direct hard deletion across financial models enforcing append-only ledger protocol', async () => {
      // Arrange
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      // Act
      const deleteSinglePromise = extended.financialLedger.delete({ where: { id: 'FL-1' } });
      const deleteManyPromise = extended.financialLedger.deleteMany({ where: { isReversal: true } });
      const deleteSupplierPromise = extended.supplierPayment.delete({ where: { id: 'SP-1' } });
      const deleteSupplierManyPromise = extended.supplierPayment.deleteMany({});

      // Assert
      await expect(deleteSinglePromise).rejects.toThrow(LedgerHardDeleteForbiddenError);
      await expect(deleteManyPromise).rejects.toThrow(LedgerHardDeleteForbiddenError);
      await expect(deleteSupplierPromise).rejects.toThrow(LedgerHardDeleteForbiddenError);
      await expect(deleteSupplierManyPromise).rejects.toThrow(LedgerHardDeleteForbiddenError);
      await expect(deleteSinglePromise).rejects.not.toThrow(TypeError);
    });

    it('3.6: allows updates to non-financial audit whitelist fields while rejecting unwhitelisted attributes', async () => {
      // Arrange
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      // Act
      const updated = await extended.financialLedger.update({
        where: { id: 'FL-1' },
        data: {
          approvalStatus: 'APPROVED',
          auditNotes: 'Updated accounting memorandum',
          syncedToSheets: true,
        },
      });

      // Assert
      expect(updated.approvalStatus).toBe('APPROVED');
      expect(updated.auditNotes).toBe('Updated accounting memorandum');
      expect(updated.syncedToSheets).toBe(true);
      expect(updated.syncedToSheets).not.toBe(false);

      // Updates outside whitelist throw
      await expect(
        extended.financialLedger.update({
          where: { id: 'FL-1' },
          data: { description: 'Updated accounting memorandum' },
        })
      ).rejects.toThrow(ImmutableLedgerError);

      await expect(
        extended.financialLedger.update({
          where: { id: 'FL-1' },
          data: { description: 'Updated accounting memorandum' },
        })
      ).rejects.not.toThrow(TypeError);
    });

    it('3.7: exempts non-financial models from ledger immutability restrictions allowing standard updates and deletions', async () => {
      // Arrange
      const client = createMockImmutabilityClient();
      const extended = hashLedgerExtension(client);

      // Act
      const updatedWorker = await extended.worker.update({
        where: { id: 'W-1' },
        data: { name: 'Sayed Ahmed' },
      });

      const deletedWorker = await extended.worker.delete({
        where: { id: 'W-1' },
      });

      // Assert
      expect(updatedWorker.name).toBe('Sayed Ahmed');
      expect(updatedWorker.name).not.toBe('');
      expect(deletedWorker).toBeDefined();
      expect(deletedWorker).not.toBeNull();
    });
  });

  // =========================================================================
  // 4. PHYSICAL REALITY INTEGRATION (REAL POSTGRESQL DATABASE CONCURRENCY & CHAIN AUDIT)
  // =========================================================================
  describe.runIf(isLive)('4. Physical Reality Integration — Real PostgreSQL Database Concurrency & Chain Audit', () => {
    let livePrisma: any;
    const testRunId = `PHYSICAL-${PINNED_BASE_TIME.getTime()}`;

    beforeAll(async () => {
      await setupTestDatabase();
      const testDbUrl = getTestDatabaseUrl();
      livePrisma = createExtendedPrismaClient({ connectionString: testDbUrl });
      await livePrisma.$connect();
      // Purge any preexisting test records matching the test run pattern
      await livePrisma.$executeRawUnsafe(`DELETE FROM financial_ledgers WHERE "voucherNumber" LIKE '#PHYSICAL-%'`);
    });

    afterAll(async () => {
      if (livePrisma) {
        // Clean up test records via direct raw SQL bypassing immutability guard
        await livePrisma.$executeRawUnsafe(`DELETE FROM financial_ledgers WHERE "voucherNumber" LIKE '#PHYSICAL-%'`).catch(() => {});
        await livePrisma.$disconnect().catch(() => {});
      }
    });

    it('4.1: persists sequential ledger mutations to PostgreSQL with valid cryptographic hashes, lineage pointers, and HMAC signatures', async () => {
      // Arrange
      const N = 5;
      const createdRecords: any[] = [];

      // Act
      for (let i = 0; i < N; i++) {
        const rec = await livePrisma.financialLedger.create({
          data: {
            voucherNumber: `#${testRunId}-SEQ-${i + 1}`,
            transactionType: 'GENERAL_EXPENSE',
            amount: 150 * (i + 1),
            currency: 'EGP',
            sourceAccount: 'TREASURY_MAIN',
            destinationAccount: 'SITE_EXPENSES',
            actorTelegramId: BigInt(10002000 + i),
          },
        });
        createdRecords.push(rec);
      }

      // Assert
      expect(createdRecords).toHaveLength(N);

      for (let i = 0; i < N; i++) {
        expect(createdRecords[i].ledgerSeq).toBeDefined();
        expect(createdRecords[i].recordHash).toHaveLength(64);
        expect(createdRecords[i].recordHash).not.toContain('undefined');
        expect(createdRecords[i].hmacSignature).toHaveLength(64);
      }

      // Verify cryptographic lineage: each record points to the previous record's hash
      for (let i = 1; i < N; i++) {
        expect(createdRecords[i].previousHash).toBe(createdRecords[i - 1].recordHash);
        expect(createdRecords[i].previousHash).not.toBe(createdRecords[i].recordHash);
      }

      // Negative assertions
      expect(createdRecords[0].recordHash).not.toBe(GENESIS_HASH);
      expect(createdRecords[0].previousHash).not.toBeNull();
    });

    it('4.2: verifies full cryptographic chain integrity across physical PostgreSQL table records via verifyLedgerChainDb', async () => {
      // Arrange
      const model = 'FinancialLedger';

      // Act
      const report = await verifyLedgerChainDb(livePrisma, { model });

      // Assert
      expect(report.isValid).toBe(true);
      expect(report.totalVerified).toBeGreaterThanOrEqual(5);
      expect(report.brokenRecordId).toBeUndefined();

      // Negative assertions
      expect(report.isValid).not.toBe(false);
      expect(report.error).toBeUndefined();
      expect(report.tamperedField).toBeUndefined();
    });

    it('4.3: detects out-of-band direct SQL tampering in PostgreSQL and reports corrupted record via verifyLedgerChainDb', async () => {
      // Arrange
      const targetVoucher = `#${testRunId}-SEQ-2`;

      // Act — Directly tamper with record 2 in the database bypassing Prisma middleware
      await livePrisma.$executeRawUnsafe(
        `UPDATE financial_ledgers SET amount = 99999.00 WHERE "voucherNumber" = '${targetVoucher}'`
      );

      const auditReport = await verifyLedgerChainDb(livePrisma, {
        model: 'FinancialLedger',
      });

      // Assert
      expect(auditReport.isValid).toBe(false);
      expect(auditReport.tamperedField).toBe('recordHash');

      // Negative assertions
      expect(auditReport.isValid).not.toBe(true);
      expect(auditReport.error).not.toBeUndefined();
      expect(auditReport.error).toContain('Tampered record detected');

      // Restore record 2 to original amount so the database remains clean
      await livePrisma.$executeRawUnsafe(
        `UPDATE financial_ledgers SET amount = 300.00 WHERE "voucherNumber" = '${targetVoucher}'`
      );
    });
  });
});
