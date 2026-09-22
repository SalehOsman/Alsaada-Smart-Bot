import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CustodyTransactionRepository,
  CustodyNotFoundError,
  InsufficientCustodyBalanceError,
  CustodyInactiveError,
  type CustodyRecord,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-01T12:00:00.000Z');

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
    disbursedAt: PINNED_BASE_TIME,
    closedAt: null,
    disbursedFromTreasuryId: 'treasury-main',
    version: 1,
    createdAt: PINNED_BASE_TIME,
    updatedAt: PINNED_BASE_TIME,
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

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
              updatedAt: new Date(PINNED_BASE_TIME.getTime()),
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
              updatedAt: new Date(PINNED_BASE_TIME.getTime()),
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

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('findAndLock', () => {
    it('01: throws error when interactive transaction client is absent', async () => {
      // Arrange
      const custodyId = 'custody-001';
      const missingTx = undefined as any;

      // Act
      const call = repository.findAndLock(custodyId, missingTx);

      // Assert
      await expect(call).rejects.toThrow('findAndLock requires an active interactive transaction client');
    });

    it('02: executes SELECT FOR UPDATE with custody ID within transaction', async () => {
      // Arrange
      const custodyId = 'custody-001';

      // Act
      const result = await repository.findAndLock(custodyId, mockPrisma);

      // Assert
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM "financial_custodies" WHERE "id" = $1 FOR UPDATE'),
        'custody-001'
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe('custody-001');
      expect(result?.currentBalance).toBe(15000);
    });

    it('03: returns null when custody does not exist within transaction', async () => {
      // Arrange
      const nonExistentId = 'non-existent';

      // Act
      const result = await repository.findAndLock(nonExistentId, mockPrisma);

      // Assert
      expect(result).toBeNull();
    });

    it('04: uses provided interactive transaction client', async () => {
      // Arrange
      const mockTx = {
        $queryRawUnsafe: vi.fn(async () => [{ ...initialCustody }]),
      };

      // Act
      const result = await repository.findAndLock('custody-001', mockTx);

      // Assert
      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(result?.id).toBe('custody-001');
    });
  });

  describe('deductFunds', () => {
    it('05: atomically deducts cash advance from custody balance', async () => {
      // Arrange
      const deductParams = {
        custodyId: 'custody-001',
        amount: 2500,
        transactionType: 'ADVANCE',
      };

      // Act
      const updated = await repository.deductFunds(deductParams);

      // Assert
      expect(updated.currentBalance).toBe(12500);
      expect(updated.totalCashAdvancesDisbursed).toBe(5500);
      expect(updated.totalLiquidatedExpenses).toBe(2000);
      expect(updated.version).toBe(2);
    });

    it('06: atomically deducts expense item from custody balance', async () => {
      // Arrange
      const deductParams = {
        custodyId: 'custody-001',
        amount: 1500,
        transactionType: 'EXPENSE',
      };

      // Act
      const updated = await repository.deductFunds(deductParams);

      // Assert
      expect(updated.currentBalance).toBe(13500);
      expect(updated.totalLiquidatedExpenses).toBe(3500);
      expect(updated.totalCashAdvancesDisbursed).toBe(3000);
      expect(updated.version).toBe(2);
    });

    it('07: throws error if deduction amount is zero or negative', async () => {
      // Arrange
      const zeroParam = { custodyId: 'custody-001', amount: 0 };
      const negativeParam = { custodyId: 'custody-001', amount: -500 };

      // Act & Assert
      // Act
      const zeroAttempt = repository.deductFunds(zeroParam);
      const negativeAttempt = repository.deductFunds(negativeParam);

      // Assert
      await expect(zeroAttempt).rejects.toThrow(/greater than 0/);
      await expect(negativeAttempt).rejects.toThrow(/greater than 0/);
    });

    it('08: throws CustodyNotFoundError if custody does not exist', async () => {
      // Arrange
      const missingParam = { custodyId: 'missing-custody', amount: 1000 };

      // Act
      const attempt = repository.deductFunds(missingParam);

      // Assert
      await expect(attempt).rejects.toThrow(CustodyNotFoundError);
    });

    it('09: throws CustodyInactiveError if custody status is not ACTIVE', async () => {
      // Arrange
      custodyStore.set('custody-001', {
        ...initialCustody,
        status: 'SETTLEMENT_PENDING',
      });
      const inactiveParam = { custodyId: 'custody-001', amount: 1000 };

      // Act
      const attempt = repository.deductFunds(inactiveParam);

      // Assert
      await expect(attempt).rejects.toThrow(CustodyInactiveError);
    });

    it('10: throws InsufficientCustodyBalanceError when requested amount exceeds currentBalance', async () => {
      // Arrange
      const overdraftParam = { custodyId: 'custody-001', amount: 25000 };

      // Act
      const attempt = repository.deductFunds(overdraftParam);

      // Assert
      await expect(attempt).rejects.toThrow(InsufficientCustodyBalanceError);
    });

    it('11: handles case-insensitive transactionType correctly', async () => {
      // Arrange
      const lowercaseParam = {
        custodyId: 'custody-001',
        amount: 800,
        transactionType: 'expense',
      };

      // Act
      const updated = await repository.deductFunds(lowercaseParam);

      // Assert
      expect(updated.currentBalance).toBe(14200);
      expect(updated.totalLiquidatedExpenses).toBe(2800);
      expect(updated.totalCashAdvancesDisbursed).toBe(3000);
    });

    it('12: automatically wraps operation in interactive transaction when tx is omitted', async () => {
      // Arrange
      let txWrapped = false;
      const clientWithTx = {
        ...mockPrisma,
        $transaction: vi.fn(async (cb: any) => {
          txWrapped = true;
          return cb(mockPrisma);
        }),
      };
      const repo = new CustodyTransactionRepository(clientWithTx);

      // Act
      const result = await repo.deductFunds({
        custodyId: 'custody-001',
        amount: 500,
        transactionType: 'ADVANCE',
      });

      // Assert
      expect(txWrapped).toBe(true);
      expect(clientWithTx.$transaction).toHaveBeenCalledTimes(1);
      expect(result.currentBalance).toBe(14500);
    });
  });

  describe('refundFunds', () => {
    it('13: atomically refunds funds to custody balance', async () => {
      // Arrange
      const refundParam = { custodyId: 'custody-001', amount: 3000 };

      // Act
      const updated = await repository.refundFunds(refundParam);

      // Assert
      expect(updated.currentBalance).toBe(18000);
      expect(updated.version).toBe(2);
    });

    it('14: throws CustodyInactiveError if custody status is not ACTIVE on refund', async () => {
      // Arrange
      custodyStore.set('custody-001', {
        ...initialCustody,
        status: 'CLOSED',
      });

      // Act
      const attempt = repository.refundFunds({
        custodyId: 'custody-001',
        amount: 1000,
      });

      // Assert
      await expect(attempt).rejects.toThrow(CustodyInactiveError);
    });

    it('15: decrements totalCashAdvancesDisbursed when refunding an advance', async () => {
      // Arrange
      const refundParam = {
        custodyId: 'custody-001',
        amount: 1000,
        transactionType: 'ADVANCE',
      };

      // Act
      const updated = await repository.refundFunds(refundParam);

      // Assert
      expect(updated.currentBalance).toBe(16000);
      expect(updated.totalCashAdvancesDisbursed).toBe(2000);
    });

    it('16: decrements totalLiquidatedExpenses when refunding an expense', async () => {
      // Arrange
      const refundParam = {
        custodyId: 'custody-001',
        amount: 500,
        transactionType: 'EXPENSE',
      };

      // Act
      const updated = await repository.refundFunds(refundParam);

      // Assert
      expect(updated.currentBalance).toBe(15500);
      expect(updated.totalLiquidatedExpenses).toBe(1500);
    });

    it('17: throws error if refund amount is zero or negative', async () => {
      // Arrange
      const zeroParam = { custodyId: 'custody-001', amount: 0 };

      // Act
      const attempt = repository.refundFunds(zeroParam);

      // Assert
      await expect(attempt).rejects.toThrow(/greater than 0/);
    });

    it('18: throws CustodyNotFoundError if custody is missing on refund', async () => {
      // Arrange
      const missingParam = { custodyId: 'missing-custody', amount: 1000 };

      // Act
      const attempt = repository.refundFunds(missingParam);

      // Assert
      await expect(attempt).rejects.toThrow(CustodyNotFoundError);
    });
  });
});
