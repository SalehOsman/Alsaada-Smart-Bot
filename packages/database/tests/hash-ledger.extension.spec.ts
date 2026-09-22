import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hashLedgerExtension,
  ImmutableLedgerError,
  LedgerHardDeleteForbiddenError,
  FINANCIAL_MODELS,
  GENESIS_HASH,
  computeRecordHash,
  acquireModelLocks,
  MODEL_LOCK_IDS,
  LEDGER_UPDATE_WHITELIST,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-11T12:00:00.000Z');

describe('hashLedgerExtension', () => {
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

  function createMockBaseClient(initialRecords: Record<string, any>[] = []) {
    const store: Record<string, any>[] = [...initialRecords];

    const mockDelegate = {
      findFirst: vi.fn(async ({ orderBy, select }: any) => {
        if (store.length === 0) return null;
        return { recordHash: store[store.length - 1]!.recordHash };
      }),
      findMany: vi.fn(async () => store),
      create: vi.fn(async ({ data }: any) => {
        store.push(data);
        return { id: 'rec-' + store.length, ...data };
      }),
      createMany: vi.fn(async ({ data }: any) => {
        const arr = Array.isArray(data) ? data : [data];
        store.push(...arr);
        return { count: arr.length };
      }),
      update: vi.fn(async ({ where, data }: any) => ({ ...store[0], ...data })),
      updateMany: vi.fn(async ({ where, data }: any) => ({ count: 1 })),
      delete: vi.fn(async () => store.pop()),
      deleteMany: vi.fn(async () => ({ count: store.length })),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = store.find((s) => s.id === where?.id);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = { id: where?.id || 'rec-' + (store.length + 1), ...create };
        store.push(created);
        return created;
      }),
    };

    const client: any = {
      $executeRawUnsafe: vi.fn(async () => {}),
      financialLedger: mockDelegate,
      supplierPayment: mockDelegate,
      worker: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: any) => data),
        update: vi.fn(async ({ data }: any) => data),
        delete: vi.fn(async () => ({})),
      },
      $extends: (extensionOrFn: any) => {
        if (typeof extensionOrFn === 'function') {
          return extensionOrFn(client);
        }
        if (extensionOrFn?.query?.$allModels) {
          const extensionQueries = extensionOrFn.query.$allModels;
          const extendedClient: any = { ...client };

          // Wrap financialLedger
          extendedClient.financialLedger = {
            ...mockDelegate,
            create: async (args: any) => {
              return extensionQueries.create({
                model: 'FinancialLedger',
                operation: 'create',
                args,
                query: mockDelegate.create,
              });
            },
            createMany: async (args: any) => {
              return extensionQueries.createMany({
                model: 'FinancialLedger',
                operation: 'createMany',
                args,
                query: mockDelegate.createMany,
              });
            },
            update: async (args: any) => {
              return extensionQueries.update({
                model: 'FinancialLedger',
                operation: 'update',
                args,
                query: mockDelegate.update,
              });
            },
            delete: async (args: any) => {
              return extensionQueries.delete({
                model: 'FinancialLedger',
                operation: 'delete',
                args,
                query: mockDelegate.delete,
              });
            },
            upsert: async (args: any) => {
              return extensionQueries.upsert({
                model: 'FinancialLedger',
                operation: 'upsert',
                args,
                query: mockDelegate.upsert,
              });
            },
          };

          // Wrap worker (non-financial)
          extendedClient.worker = {
            ...client.worker,
            create: async (args: any) => {
              return extensionQueries.create({
                model: 'Worker',
                operation: 'create',
                args,
                query: client.worker.create,
              });
            },
            update: async (args: any) => {
              return extensionQueries.update({
                model: 'Worker',
                operation: 'update',
                args,
                query: client.worker.update,
              });
            },
            delete: async (args: any) => {
              return extensionQueries.delete({
                model: 'Worker',
                operation: 'delete',
                args,
                query: client.worker.delete,
              });
            },
          };

          return extendedClient;
        }
        return client;
      },
    };

    return { client, store, mockDelegate };
  }

  it('01: recognizes all financial transaction models and rejects non-financial models', () => {
    // Arrange
    const knownFinancial = 'FinancialLedger';
    const nonFinancial = 'Worker';

    // Act
    const hasFinancial = FINANCIAL_MODELS.has(knownFinancial);
    const hasNonFinancial = FINANCIAL_MODELS.has(nonFinancial);

    // Assert
    expect(hasFinancial).toBe(true);
    expect(hasNonFinancial).toBe(false);
    expect(FINANCIAL_MODELS.has('SupplierPayment')).toBe(true);
    expect(FINANCIAL_MODELS.has('CustodyExpenseItem')).toBe(true);
    expect(FINANCIAL_MODELS.has('CustodySettlement')).toBe(true);
    expect(FINANCIAL_MODELS.has('HospitalityExpense')).toBe(true);
    expect(FINANCIAL_MODELS.has('WorkerExpenseClaim')).toBe(true);
  });

  it('02: automatically computes recordHash and assigns genesis hash on first record', async () => {
    // Arrange
    const { client, store } = createMockBaseClient();
    const extended = hashLedgerExtension(client);
    const timestamp = PINNED_BASE_TIME;

    // Act
    await extended.financialLedger.create({
      data: {
        voucherNumber: '#ADV-2026-0001',
        amount: 5000,
        actorTelegramId: '123456789',
        hashTimestamp: timestamp,
      },
    });

    // Assert
    expect(store).toHaveLength(1);
    const created = store[0]!;
    expect(created.previousHash).toBe(GENESIS_HASH);
    expect(created.recordHash).toBe(
      computeRecordHash({
        previousHash: GENESIS_HASH,
        voucherNumber: '#ADV-2026-0001',
        model: 'FinancialLedger',
        amount: 5000,
        actorId: '123456789',
        timestamp,
      })
    );
  });

  it('03: chains consecutive single mutations sequentially', async () => {
    // Arrange
    const { client, store } = createMockBaseClient();
    const extended = hashLedgerExtension(client);
    const ts1 = new Date('2026-09-11T10:00:00.000Z');
    const ts2 = new Date('2026-09-11T10:05:00.000Z');

    // Act
    await extended.financialLedger.create({
      data: {
        voucherNumber: '#ADV-2026-0001',
        amount: 5000,
        actorTelegramId: '123456789',
        hashTimestamp: ts1,
      },
    });
    const firstHash = store[0]!.recordHash;

    await extended.financialLedger.create({
      data: {
        voucherNumber: '#ADV-2026-0002',
        amount: 2500,
        actorTelegramId: '987654321',
        hashTimestamp: ts2,
      },
    });

    // Assert
    expect(store).toHaveLength(2);
    const second = store[1]!;
    expect(second.previousHash).toBe(firstHash);
    expect(second.recordHash).toBe(
      computeRecordHash({
        previousHash: firstHash,
        voucherNumber: '#ADV-2026-0002',
        model: 'FinancialLedger',
        amount: 2500,
        actorId: '987654321',
        timestamp: ts2,
      })
    );
  });

  it('04: chains records in a batch createMany sequentially', async () => {
    // Arrange
    const { client, store } = createMockBaseClient();
    const extended = hashLedgerExtension(client);
    const items = [
      { voucherNumber: '#PAY-01', amount: 1000, actorTelegramId: '111', hashTimestamp: new Date('2026-09-11T11:00:00.000Z') },
      { voucherNumber: '#PAY-02', amount: 2000, actorTelegramId: '222', hashTimestamp: new Date('2026-09-11T11:01:00.000Z') },
      { voucherNumber: '#PAY-03', amount: 3000, actorTelegramId: '333', hashTimestamp: new Date('2026-09-11T11:02:00.000Z') },
    ];

    // Act
    await extended.financialLedger.createMany({ data: items });

    // Assert
    expect(store).toHaveLength(3);
    expect(store[0]!.previousHash).toBe(GENESIS_HASH);
    expect(store[1]!.previousHash).toBe(store[0]!.recordHash);
    expect(store[2]!.previousHash).toBe(store[1]!.recordHash);
  });

  it('05: forbids updating immutable financial ledger fields', async () => {
    // Arrange
    const { client } = createMockBaseClient([{ id: '1', amount: 1000, recordHash: 'h1', previousHash: 'h0' }]);
    const extended = hashLedgerExtension(client);

    // Act & Assert
    // Act
    const updateAmount = extended.financialLedger.update({
      where: { id: '1' },
      data: { amount: 5000 },
    });
    const updateHash = extended.financialLedger.update({
      where: { id: '1' },
      data: { recordHash: 'tampered-hash' },
    });
    const updatePrev = extended.financialLedger.update({
      where: { id: '1' },
      data: { previousHash: 'fake-prev' },
    });

    // Assert
    await expect(updateAmount).rejects.toThrow(ImmutableLedgerError);
    await expect(updateHash).rejects.toThrow(ImmutableLedgerError);
    await expect(updatePrev).rejects.toThrow(ImmutableLedgerError);
  });

  it('06: forbids direct hard deletion on financial models', async () => {
    // Arrange
    const { client } = createMockBaseClient([{ id: '1' }]);
    const extended = hashLedgerExtension(client);

    // Act
    const deleteAttempt = extended.financialLedger.delete({ where: { id: '1' } });

    // Assert
    await expect(deleteAttempt).rejects.toThrow(LedgerHardDeleteForbiddenError);
  });

  it('07: allows normal mutations on non-financial models without cryptographic hashing', async () => {
    // Arrange
    const { client } = createMockBaseClient();
    const extended = hashLedgerExtension(client);

    // Act
    const created = await extended.worker.create({ data: { name: 'Ali' } });
    const updated = await extended.worker.update({ where: { id: '1' }, data: { name: 'Hassan' } });

    // Assert
    expect(created.name).toBe('Ali');
    expect(created.recordHash).toBeUndefined();
    expect(updated.name).toBe('Hassan');
  });

  it('08: allows updating fields present in LEDGER_UPDATE_WHITELIST', async () => {
    // Arrange
    const { client } = createMockBaseClient([{ id: '1', amount: 1000, approvalStatus: 'PENDING' }]);
    const extended = hashLedgerExtension(client);

    // Act
    const updated = await extended.financialLedger.update({
      where: { id: '1' },
      data: { approvalStatus: 'APPROVED', auditNotes: 'Verified and approved' },
    });

    // Assert
    expect(updated.approvalStatus).toBe('APPROVED');
    expect(updated.auditNotes).toBe('Verified and approved');
  });

  it('09: rejects updating fields outside LEDGER_UPDATE_WHITELIST', async () => {
    // Arrange
    const { client } = createMockBaseClient([{ id: '1', amount: 1000 }]);
    const extended = hashLedgerExtension(client);

    // Act
    const unauthorizedUpdate = extended.financialLedger.update({
      where: { id: '1' },
      data: { description: 'Unauthorized description edit' },
    });

    // Assert
    await expect(unauthorizedUpdate).rejects.toThrow(ImmutableLedgerError);
  });

  it('10: verifies MODEL_LOCK_IDS covers all core financial models and payroll record alias', () => {
    // Arrange
    const lockIds = MODEL_LOCK_IDS;

    // Act
    const ledgerLockId = lockIds.financialledger;

    // Assert
    expect(ledgerLockId).toBe(1);
    expect(lockIds.financialcustody).toBe(2);
    expect(lockIds.custodyexpenseitem).toBe(3);
    expect(lockIds.custodysettlement).toBe(4);
    expect(lockIds.hospitalityexpense).toBe(5);
    expect(lockIds.workerexpenseclaim).toBe(6);
    expect(lockIds.supplierpayment).toBe(7);
    expect(lockIds.supplierinvoice).toBe(8);
    expect(lockIds.advancerequest).toBe(9);
    expect(lockIds.advanceinstallment).toBe(10);
    expect(lockIds.payrolltransaction).toBe(11);
    expect(lockIds.payrollrecord).toBe(11);
    expect(lockIds.attendancerecord).toBe(12);
  });

  it('11: includes PayrollRecord in FINANCIAL_MODELS', () => {
    // Arrange
    const pascalName = 'PayrollRecord';
    const camelName = 'payrollRecord';

    // Act
    const hasPascal = FINANCIAL_MODELS.has(pascalName);
    const hasCamel = FINANCIAL_MODELS.has(camelName);

    // Assert
    expect(hasPascal).toBe(true);
    expect(hasCamel).toBe(true);
  });

  it('12: acquires advisory locks in strict ascending order to prevent deadlocks', async () => {
    // Arrange
    const executedQueries: string[] = [];
    const client = {
      $executeRawUnsafe: vi.fn(async (_sql: string, _ns: number, lockId: number) => {
        executedQueries.push(`lock_${lockId}`);
      }),
    };

    // Act
    const acquired = await acquireModelLocks(client, ['supplierpayment', 'financialledger']);

    // Assert
    expect(acquired).toEqual([1, 7]);
    expect(executedQueries).toEqual(['lock_1', 'lock_7']);
  });

  describe('upsert interception', () => {
    it('13: allows upsert update when modified fields are within whitelist', async () => {
      // Arrange
      const { client } = createMockBaseClient([{ id: 'FL-UP-1', amount: 1000, approvalStatus: 'PENDING' }]);
      const extended = hashLedgerExtension(client);

      // Act
      const result = await extended.financialLedger.upsert({
        where: { id: 'FL-UP-1' },
        update: { approvalStatus: 'APPROVED', auditNotes: 'Approved via upsert' },
        create: { voucherNumber: '#V-NEW', amount: 500 },
      });

      // Assert
      expect(result.approvalStatus).toBe('APPROVED');
      expect(result.auditNotes).toBe('Approved via upsert');
    });

    it('14: rejects upsert update when fields violate whitelist', async () => {
      // Arrange
      const { client } = createMockBaseClient([{ id: 'FL-UP-1', amount: 1000 }]);
      const extended = hashLedgerExtension(client);

      // Act
      const attempt = extended.financialLedger.upsert({
        where: { id: 'FL-UP-1' },
        update: { amount: 2000 },
        create: { voucherNumber: '#V-NEW', amount: 2000 },
      });

      // Assert
      await expect(attempt).rejects.toThrow(ImmutableLedgerError);
    });

    it('15: computes cryptographic record hash when upsert triggers create branch', async () => {
      // Arrange
      const { client } = createMockBaseClient([]);
      const extended = hashLedgerExtension(client);

      // Act
      const created = await extended.financialLedger.upsert({
        where: { id: 'FL-NEW' },
        update: { approvalStatus: 'APPROVED' },
        create: {
          id: 'FL-NEW',
          voucherNumber: '#V-UPSERT-001',
          amount: 3500,
          actorTelegramId: '123456789',
        },
      });

      // Assert
      expect(created.recordHash).toBeDefined();
      expect(created.recordHash.length).toBe(64);
      expect(created.previousHash).toBe(GENESIS_HASH);
    });
  });
});
