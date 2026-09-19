import { describe, it, expect, vi } from 'vitest';
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

describe('hashLedgerExtension', () => {
  function createMockBaseClient(initialRecords: Record<string, any>[] = []) {
    const store: Record<string, any>[] = [...initialRecords];

    const mockDelegate = {
      findFirst: vi.fn(async ({ orderBy, select }) => {
        if (store.length === 0) return null;
        // Return latest
        return { recordHash: store[store.length - 1]!.recordHash };
      }),
      findMany: vi.fn(async () => store),
      create: vi.fn(async ({ data }) => {
        store.push(data);
        return { id: 'rec-' + store.length, ...data };
      }),
      createMany: vi.fn(async ({ data }) => {
        const arr = Array.isArray(data) ? data : [data];
        store.push(...arr);
        return { count: arr.length };
      }),
      update: vi.fn(async ({ where, data }) => ({ ...store[0], ...data })),
      updateMany: vi.fn(async ({ where, data }) => ({ count: 1 })),
      delete: vi.fn(async () => store.pop()),
      deleteMany: vi.fn(async () => ({ count: store.length })),
      upsert: vi.fn(async ({ where, create, update }) => {
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
        create: vi.fn(async ({ data }) => data),
        update: vi.fn(async ({ data }) => data),
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

  it('recognizes all 6 financial transaction models', () => {
    expect(FINANCIAL_MODELS.has('FinancialLedger')).toBe(true);
    expect(FINANCIAL_MODELS.has('SupplierPayment')).toBe(true);
    expect(FINANCIAL_MODELS.has('CustodyExpenseItem')).toBe(true);
    expect(FINANCIAL_MODELS.has('CustodySettlement')).toBe(true);
    expect(FINANCIAL_MODELS.has('HospitalityExpense')).toBe(true);
    expect(FINANCIAL_MODELS.has('WorkerExpenseClaim')).toBe(true);
    expect(FINANCIAL_MODELS.has('Worker')).toBe(false);
  });

  it('automatically computes recordHash and assigns previousHash = GENESIS_HASH on first record', async () => {
    const { client, store } = createMockBaseClient();
    const extended = hashLedgerExtension(client);

    const timestamp = new Date('2026-09-11T10:00:00Z');
    await extended.financialLedger.create({
      data: {
        voucherNumber: '#ADV-2026-0001',
        amount: 5000,
        actorTelegramId: '123456789',
        hashTimestamp: timestamp,
      },
    });

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

  it('chains consecutive single mutations sequentially', async () => {
    const { client, store } = createMockBaseClient();
    const extended = hashLedgerExtension(client);

    const ts1 = new Date('2026-09-11T10:00:00Z');
    await extended.financialLedger.create({
      data: {
        voucherNumber: '#ADV-2026-0001',
        amount: 5000,
        actorTelegramId: '123456789',
        hashTimestamp: ts1,
      },
    });

    const firstHash = store[0]!.recordHash;

    const ts2 = new Date('2026-09-11T10:05:00Z');
    await extended.financialLedger.create({
      data: {
        voucherNumber: '#ADV-2026-0002',
        amount: 2500,
        actorTelegramId: '987654321',
        hashTimestamp: ts2,
      },
    });

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

  it('chains records in a batch createMany sequentially', async () => {
    const { client, store } = createMockBaseClient();
    const extended = hashLedgerExtension(client);

    const items = [
      { voucherNumber: '#PAY-01', amount: 1000, actorTelegramId: '111', hashTimestamp: new Date('2026-09-11T11:00:00Z') },
      { voucherNumber: '#PAY-02', amount: 2000, actorTelegramId: '222', hashTimestamp: new Date('2026-09-11T11:01:00Z') },
      { voucherNumber: '#PAY-03', amount: 3000, actorTelegramId: '333', hashTimestamp: new Date('2026-09-11T11:02:00Z') },
    ];

    await extended.financialLedger.createMany({ data: items });

    expect(store).toHaveLength(3);
    expect(store[0]!.previousHash).toBe(GENESIS_HASH);
    expect(store[1]!.previousHash).toBe(store[0]!.recordHash);
    expect(store[2]!.previousHash).toBe(store[1]!.recordHash);
  });

  it('forbids updating immutable financial ledger fields (amount, recordHash, previousHash, hashTimestamp)', async () => {
    const { client } = createMockBaseClient([{ id: '1', amount: 1000, recordHash: 'h1', previousHash: 'h0' }]);
    const extended = hashLedgerExtension(client);

    await expect(
      extended.financialLedger.update({
        where: { id: '1' },
        data: { amount: 5000 },
      })
    ).rejects.toThrow(ImmutableLedgerError);

    await expect(
      extended.financialLedger.update({
        where: { id: '1' },
        data: { recordHash: 'tampered-hash' },
      })
    ).rejects.toThrow(ImmutableLedgerError);

    await expect(
      extended.financialLedger.update({
        where: { id: '1' },
        data: { previousHash: 'fake-prev' },
      })
    ).rejects.toThrow(ImmutableLedgerError);
  });

  it('forbids direct hard deletion on financial models', async () => {
    const { client } = createMockBaseClient([{ id: '1' }]);
    const extended = hashLedgerExtension(client);

    await expect(
      extended.financialLedger.delete({ where: { id: '1' } })
    ).rejects.toThrow(LedgerHardDeleteForbiddenError);
  });

  it('allows normal mutations on non-financial models', async () => {
    const { client } = createMockBaseClient();
    const extended = hashLedgerExtension(client);

    const created = await extended.worker.create({ data: { name: 'Ali' } });
    expect(created.name).toBe('Ali');
    expect(created.recordHash).toBeUndefined();

    const updated = await extended.worker.update({ where: { id: '1' }, data: { name: 'Hassan' } });
    expect(updated.name).toBe('Hassan');
  });

  it('allows updating fields present in LEDGER_UPDATE_WHITELIST', async () => {
    const { client } = createMockBaseClient([{ id: '1', amount: 1000, approvalStatus: 'PENDING' }]);
    const extended = hashLedgerExtension(client);

    const updated = await extended.financialLedger.update({
      where: { id: '1' },
      data: { approvalStatus: 'APPROVED', auditNotes: 'Verified and approved' },
    });

    expect(updated.approvalStatus).toBe('APPROVED');
    expect(updated.auditNotes).toBe('Verified and approved');
  });

  it('rejects updating fields outside LEDGER_UPDATE_WHITELIST', async () => {
    const { client } = createMockBaseClient([{ id: '1', amount: 1000 }]);
    const extended = hashLedgerExtension(client);

    await expect(
      extended.financialLedger.update({
        where: { id: '1' },
        data: { description: 'Unauthorized description edit' },
      })
    ).rejects.toThrow(ImmutableLedgerError);
  });

  it('verifies MODEL_LOCK_IDS covers all 12 core financial models and payrollrecord alias', () => {
    expect(MODEL_LOCK_IDS.financialledger).toBe(1);
    expect(MODEL_LOCK_IDS.financialcustody).toBe(2);
    expect(MODEL_LOCK_IDS.custodyexpenseitem).toBe(3);
    expect(MODEL_LOCK_IDS.custodysettlement).toBe(4);
    expect(MODEL_LOCK_IDS.hospitalityexpense).toBe(5);
    expect(MODEL_LOCK_IDS.workerexpenseclaim).toBe(6);
    expect(MODEL_LOCK_IDS.supplierpayment).toBe(7);
    expect(MODEL_LOCK_IDS.supplierinvoice).toBe(8);
    expect(MODEL_LOCK_IDS.advancerequest).toBe(9);
    expect(MODEL_LOCK_IDS.advanceinstallment).toBe(10);
    expect(MODEL_LOCK_IDS.payrolltransaction).toBe(11);
    expect(MODEL_LOCK_IDS.payrollrecord).toBe(11);
    expect(MODEL_LOCK_IDS.attendancerecord).toBe(12);
  });

  it('includes PayrollRecord in FINANCIAL_MODELS', () => {
    expect(FINANCIAL_MODELS.has('PayrollRecord')).toBe(true);
    expect(FINANCIAL_MODELS.has('payrollRecord')).toBe(true);
  });

  it('acquires advisory locks in strict ascending order to prevent deadlocks', async () => {
    const executedQueries: string[] = [];
    const client = {
      $executeRawUnsafe: vi.fn(async (sql: string, ns: number, lockId: number) => {
        executedQueries.push(`lock_${lockId}`);
      }),
    };

    // Pass models in reverse order: SupplierPayment (7) and FinancialLedger (1)
    const acquired = await acquireModelLocks(client, ['supplierpayment', 'financialledger']);

    expect(acquired).toEqual([1, 7]);
    expect(executedQueries).toEqual(['lock_1', 'lock_7']);
  });

  describe('upsert interception', () => {
    it('allows upsert update when modified fields are within LEDGER_UPDATE_WHITELIST', async () => {
      const { client } = createMockBaseClient([{ id: 'FL-UP-1', amount: 1000, approvalStatus: 'PENDING' }]);
      const extended = hashLedgerExtension(client);

      const result = await extended.financialLedger.upsert({
        where: { id: 'FL-UP-1' },
        update: { approvalStatus: 'APPROVED', auditNotes: 'Approved via upsert' },
        create: { voucherNumber: '#V-NEW', amount: 500 },
      });

      expect(result.approvalStatus).toBe('APPROVED');
      expect(result.auditNotes).toBe('Approved via upsert');
    });

    it('rejects upsert update when fields violate LEDGER_UPDATE_WHITELIST', async () => {
      const { client } = createMockBaseClient([{ id: 'FL-UP-1', amount: 1000 }]);
      const extended = hashLedgerExtension(client);

      await expect(
        extended.financialLedger.upsert({
          where: { id: 'FL-UP-1' },
          update: { amount: 2000 },
          create: { voucherNumber: '#V-NEW', amount: 2000 },
        })
      ).rejects.toThrow(ImmutableLedgerError);
    });

    it('computes cryptographic record hash when upsert triggers create branch', async () => {
      const { client } = createMockBaseClient([]);
      const extended = hashLedgerExtension(client);

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

      expect(created.recordHash).toBeDefined();
      expect(created.recordHash.length).toBe(64);
      expect(created.previousHash).toBe(GENESIS_HASH);
    });
  });
});
