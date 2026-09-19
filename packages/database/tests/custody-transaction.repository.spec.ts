import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CustodyTransactionRepository,
  CustodyNotFoundError,
  InsufficientCustodyBalanceError,
  CustodyInactiveError,
  type CustodyRecord,
} from '../src/index.js';

describe('CustodyTransactionRepository — Forensic Atomic Repository', () => {
  let mockPrisma: any;
  let repository: CustodyTransactionRepository;
  let custodyStore: Map<string, CustodyRecord>;

  const initialCustody: CustodyRecord = {
    id: 'custody-001',
    custodyNumber: '#FC-2026-001',
    siteId: 'site-alpha',
    custodianWorkerId: 'worker-101',
    initialAmount: 20000,
    currentBalance: 15000,
    totalLiquidatedExpenses: 2000,
    totalCashAdvancesDisbursed: 3000,
    purpose: 'عهدة الموقع للمصروفات والسلف الطارئة',
    status: 'ACTIVE',
    disbursedAt: new Date('2026-09-01T00:00:00Z'),
    closedAt: null,
    disbursedFromTreasuryId: 'treasury-main',
    version: 1,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
  };

  beforeEach(() => {
    custodyStore = new Map();
    custodyStore.set('custody-001', { ...initialCustody });

    mockPrisma = {
      $queryRawUnsafe: vi.fn(async (sql: string, ...params: any[]) => {
        if (sql.includes('SELECT * FROM "financial_custodies" WHERE "id" = $1 FOR UPDATE')) {
          const id = params[0];
          const rec = custodyStore.get(id);
          return rec ? [{ ...rec }] : [];
        }

        if (sql.includes('UPDATE "financial_custodies"')) {
          if (sql.includes('"currentBalance" = "currentBalance" - $1')) {
            // Deduct
            const [amount, expInc, advInc, id] = params;
            const rec = custodyStore.get(id);
            if (!rec) return [];
            if (rec.status !== 'ACTIVE' || Number(rec.currentBalance) < Number(amount)) {
              return [];
            }
            const updated: CustodyRecord = {
              ...rec,
              currentBalance: Number(rec.currentBalance) - Number(amount),
              totalLiquidatedExpenses: Number(rec.totalLiquidatedExpenses) + Number(expInc),
              totalCashAdvancesDisbursed: Number(rec.totalCashAdvancesDisbursed) + Number(advInc),
              version: rec.version + 1,
              updatedAt: new Date(),
            };
            custodyStore.set(id, updated);
            return [{ ...updated }];
          }

          if (sql.includes('"currentBalance" = "currentBalance" + $1')) {
            // Refund
            const [amount, expDec, advDec, id] = params;
            const rec = custodyStore.get(id);
            if (!rec) return [];
            if (rec.status !== 'ACTIVE') return [];
            const updated: CustodyRecord = {
              ...rec,
              currentBalance: Number(rec.currentBalance) + Number(amount),
              totalLiquidatedExpenses: Math.max(0, Number(rec.totalLiquidatedExpenses) - Number(expDec || 0)),
              totalCashAdvancesDisbursed: Math.max(0, Number(rec.totalCashAdvancesDisbursed) - Number(advDec || 0)),
              version: rec.version + 1,
              updatedAt: new Date(),
            };
            custodyStore.set(id, updated);
            return [{ ...updated }];
          }
        }

        return [];
      }),
    };

    repository = new CustodyTransactionRepository(mockPrisma);
  });

  describe('findAndLock', () => {
    it('executes SELECT FOR UPDATE with custody ID', async () => {
      const result = await repository.findAndLock('custody-001');

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM "financial_custodies" WHERE "id" = $1 FOR UPDATE'),
        'custody-001'
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe('custody-001');
      expect(result?.currentBalance).toBe(15000);
    });

    it('returns null when custody does not exist', async () => {
      const result = await repository.findAndLock('non-existent');
      expect(result).toBeNull();
    });

    it('uses provided interactive transaction client if supplied', async () => {
      const mockTx = {
        $queryRawUnsafe: vi.fn(async () => [{ ...initialCustody }]),
      };

      const result = await repository.findAndLock('custody-001', mockTx);
      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(result?.id).toBe('custody-001');
    });
  });

  describe('deductFunds', () => {
    it('atomically deducts cash advance from custody balance', async () => {
      const updated = await repository.deductFunds({
        custodyId: 'custody-001',
        amount: 2500,
        transactionType: 'ADVANCE',
      });

      expect(updated.currentBalance).toBe(12500);
      expect(updated.totalCashAdvancesDisbursed).toBe(5500);
      expect(updated.totalLiquidatedExpenses).toBe(2000);
      expect(updated.version).toBe(2);
    });

    it('atomically deducts expense item from custody balance', async () => {
      const updated = await repository.deductFunds({
        custodyId: 'custody-001',
        amount: 1500,
        transactionType: 'EXPENSE',
      });

      expect(updated.currentBalance).toBe(13500);
      expect(updated.totalLiquidatedExpenses).toBe(3500);
      expect(updated.totalCashAdvancesDisbursed).toBe(3000);
      expect(updated.version).toBe(2);
    });

    it('throws error if deduction amount is zero or negative', async () => {
      await expect(
        repository.deductFunds({
          custodyId: 'custody-001',
          amount: 0,
        })
      ).rejects.toThrow(/greater than 0/);

      await expect(
        repository.deductFunds({
          custodyId: 'custody-001',
          amount: -500,
        })
      ).rejects.toThrow(/greater than 0/);
    });

    it('throws CustodyNotFoundError if custody does not exist', async () => {
      await expect(
        repository.deductFunds({
          custodyId: 'missing-custody',
          amount: 1000,
        })
      ).rejects.toThrow(CustodyNotFoundError);
    });

    it('throws CustodyInactiveError if custody status is not ACTIVE', async () => {
      custodyStore.set('custody-001', {
        ...initialCustody,
        status: 'SETTLEMENT_PENDING',
      });

      await expect(
        repository.deductFunds({
          custodyId: 'custody-001',
          amount: 1000,
        })
      ).rejects.toThrow(CustodyInactiveError);
    });

    it('throws InsufficientCustodyBalanceError when requested amount exceeds currentBalance', async () => {
      await expect(
        repository.deductFunds({
          custodyId: 'custody-001',
          amount: 25000, // available is 15000
        })
      ).rejects.toThrow(InsufficientCustodyBalanceError);
    });

    it('handles case-insensitive transactionType (e.g. lowercase "expense")', async () => {
      const updated = await repository.deductFunds({
        custodyId: 'custody-001',
        amount: 800,
        transactionType: 'expense',
      });

      expect(updated.currentBalance).toBe(14200);
      expect(updated.totalLiquidatedExpenses).toBe(2800);
      expect(updated.totalCashAdvancesDisbursed).toBe(3000);
    });

    it('automatically wraps operation in interactive transaction when tx is omitted', async () => {
      let txWrapped = false;
      const clientWithTx = {
        ...mockPrisma,
        $transaction: vi.fn(async (cb: any) => {
          txWrapped = true;
          return cb(mockPrisma);
        }),
      };
      const repo = new CustodyTransactionRepository(clientWithTx);

      const result = await repo.deductFunds({
        custodyId: 'custody-001',
        amount: 500,
        transactionType: 'ADVANCE',
      });

      expect(txWrapped).toBe(true);
      expect(clientWithTx.$transaction).toHaveBeenCalledTimes(1);
      expect(result.currentBalance).toBe(14500);
    });
  });

  describe('refundFunds', () => {
    it('atomically refunds funds to custody balance', async () => {
      const updated = await repository.refundFunds({
        custodyId: 'custody-001',
        amount: 3000,
      });

      expect(updated.currentBalance).toBe(18000);
      expect(updated.version).toBe(2);
    });

    it('throws CustodyInactiveError if custody status is not ACTIVE on refund', async () => {
      custodyStore.set('custody-001', {
        ...initialCustody,
        status: 'CLOSED',
      });

      await expect(
        repository.refundFunds({
          custodyId: 'custody-001',
          amount: 1000,
        })
      ).rejects.toThrow(CustodyInactiveError);
    });

    it('decrements totalCashAdvancesDisbursed when refunding an advance', async () => {
      const updated = await repository.refundFunds({
        custodyId: 'custody-001',
        amount: 1000,
        transactionType: 'ADVANCE',
      });

      expect(updated.currentBalance).toBe(16000);
      expect(updated.totalCashAdvancesDisbursed).toBe(2000); // was 3000
    });

    it('decrements totalLiquidatedExpenses when refunding an expense', async () => {
      const updated = await repository.refundFunds({
        custodyId: 'custody-001',
        amount: 500,
        transactionType: 'EXPENSE',
      });

      expect(updated.currentBalance).toBe(15500);
      expect(updated.totalLiquidatedExpenses).toBe(1500); // was 2000
    });

    it('throws error if refund amount is zero or negative', async () => {
      await expect(
        repository.refundFunds({
          custodyId: 'custody-001',
          amount: 0,
        })
      ).rejects.toThrow(/greater than 0/);
    });

    it('throws CustodyNotFoundError if custody is missing on refund', async () => {
      await expect(
        repository.refundFunds({
          custodyId: 'missing-custody',
          amount: 1000,
        })
      ).rejects.toThrow(CustodyNotFoundError);
    });
  });
});
