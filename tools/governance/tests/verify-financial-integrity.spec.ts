import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  verifyFinancialIntegrity,
  PROTECTED_FINANCIAL_MODELS,
} from '../verify-financial-integrity.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('🏛️ G13: verify-financial-integrity governance gate', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function createMockPrisma(overrides: {
    custodies?: any[];
    advances?: any[];
    ledgers?: any[];
    hashChainResult?: { isValid: boolean; error?: string; brokenRecordId?: string; totalVerified: number };
  } = {}) {
    const custodies = overrides.custodies ?? [
      {
        id: 'custody-1',
        custodyNumber: '#FC-2026-001',
        initialAmount: 1000,
        totalLiquidatedExpenses: 300,
        totalCashAdvancesDisbursed: 200,
        currentBalance: 500,
        status: 'ACTIVE',
        closedAt: null,
      },
    ];

    const advances = overrides.advances ?? [
      {
        id: 'adv-1',
        voucherNumber: '#ADV-2026-001',
        transactionType: 'ADVANCE_CASH',
        sourceCustodyId: 'custody-1',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ];

    const ledgers = overrides.ledgers ?? [
      {
        id: 'adv-1',
        voucherNumber: '#ADV-2026-001',
        isReversal: false,
        reversalOfVoucherId: null,
      },
      {
        id: 'rev-1',
        voucherNumber: '#REV-2026-001',
        isReversal: true,
        reversalOfVoucherId: '#ADV-2026-001',
      },
    ];

    const defaultChainReport = overrides.hashChainResult ?? {
      isValid: true,
      totalVerified: 10,
    };

    const client: any = {
      financialCustody: {
        findMany: vi.fn().mockResolvedValue(custodies),
      },
      financialLedger: {
        findMany: vi.fn().mockImplementation((args?: any) => {
          if (args?.orderBy) {
            return Promise.resolve([]);
          }
          if (args?.where?.transactionType === 'ADVANCE_CASH') {
            return Promise.resolve(advances);
          }
          return Promise.resolve(ledgers);
        }),
      },
      supplierPayment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      custodyExpenseItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      custodySettlement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      hospitalityExpense: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      workerExpenseClaim: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    return { client, defaultChainReport };
  }

  it('1. passes when all 6 hash chains, custodies, advances, and reversals are intact', async () => {
    // Arrange
    const { client } = createMockPrisma();

    // Act
    const result = await verifyFinancialIntegrity({ prisma: client });

    // Assert
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.checked).toBeGreaterThan(0);
  });

  it('2. verifies all 6 protected financial models in the schema', () => {
    // Arrange
    const expectedModels = [
      'FinancialLedger',
      'SupplierPayment',
      'CustodyExpenseItem',
      'CustodySettlement',
      'HospitalityExpense',
      'WorkerExpenseClaim',
    ];

    // Act & Assert
    // Arrange
    const models = PROTECTED_FINANCIAL_MODELS;

    // Act
    const count = models.length;

    // Assert
    expect(models).toEqual(expectedModels);
    expect(count).toBe(6);
    expect(models).not.toContain('User');
  });

  it('3. rejects broken cryptographic hash chain in financial models', async () => {
    // Arrange
    const { client } = createMockPrisma();
    client.financialLedger.findMany = vi.fn().mockResolvedValue([
      {
        id: 'bad-1',
        recordHash: 'corrupted_hash',
        previousHash: 'wrong_pointer',
        hashTimestamp: new Date('2026-03-01T12:00:00.000Z'),
        amount: 100,
        createdAt: new Date('2026-03-01T12:00:00.000Z'),
      },
    ]);

    // Act
    const result = await verifyFinancialIntegrity({ prisma: client });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('Cryptographic hash chain broken in model'))).toBe(true);
    expect(result.failures).not.toHaveLength(0);
  });

  it('4. detects custody equation balance discrepancy', async () => {
    // Arrange
    const { client } = createMockPrisma({
      custodies: [
        {
          id: 'custody-bad',
          custodyNumber: '#FC-BAD-01',
          initialAmount: 1000,
          totalLiquidatedExpenses: 200,
          totalCashAdvancesDisbursed: 100,
          currentBalance: 800,
          status: 'ACTIVE',
        },
      ],
    });

    // Act
    const result = await verifyFinancialIntegrity({ prisma: client });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('Custody balance discrepancy'))).toBe(true);
    expect(result.failures).not.toHaveLength(0);
  });

  it('5. detects illegal negative balance in custody', async () => {
    // Arrange
    const { client } = createMockPrisma({
      custodies: [
        {
          id: 'custody-neg',
          custodyNumber: '#FC-NEG-01',
          initialAmount: 1000,
          totalLiquidatedExpenses: 800,
          totalCashAdvancesDisbursed: 250,
          currentBalance: -50,
          status: 'ACTIVE',
        },
      ],
    });

    // Act
    const result = await verifyFinancialIntegrity({ prisma: client });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('illegal negative balance'))).toBe(true);
    expect(result.failures).not.toHaveLength(0);
  });

  it('6. rejects cash advance without linked sourceCustodyId', async () => {
    // Arrange
    const { client } = createMockPrisma({
      advances: [
        {
          id: 'adv-no-custody',
          voucherNumber: '#ADV-NOCUSTODY-01',
          transactionType: 'ADVANCE_CASH',
          sourceCustodyId: null,
          createdAt: new Date('2026-03-01T12:00:00.000Z'),
        },
      ],
    });

    // Act
    const result = await verifyFinancialIntegrity({ prisma: client });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('no linked site custody'))).toBe(true);
    expect(result.failures).not.toHaveLength(0);
  });

  it('7. rejects cash advance referencing non-existent custody ID', async () => {
    // Arrange
    const { client } = createMockPrisma({
      advances: [
        {
          id: 'adv-ghost',
          voucherNumber: '#ADV-GHOST-01',
          transactionType: 'ADVANCE_CASH',
          sourceCustodyId: 'non-existent-custody-uuid',
          createdAt: new Date('2026-03-01T12:00:00.000Z'),
        },
      ],
    });

    // Act
    const result = await verifyFinancialIntegrity({ prisma: client });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('references non-existent custody ID'))).toBe(true);
    expect(result.failures).not.toHaveLength(0);
  });

  it('8. rejects cash advance disbursed from an already closed custody', async () => {
    // Arrange
    const { client } = createMockPrisma({
      custodies: [
        {
          id: 'custody-closed',
          custodyNumber: '#FC-CLOSED-01',
          initialAmount: 500,
          totalLiquidatedExpenses: 250,
          totalCashAdvancesDisbursed: 250,
          currentBalance: 0,
          status: 'CLOSED',
          closedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      advances: [
        {
          id: 'adv-late',
          voucherNumber: '#ADV-LATE-01',
          transactionType: 'ADVANCE_CASH',
          sourceCustodyId: 'custody-closed',
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
        },
      ],
    });

    // Act
    const result = await verifyFinancialIntegrity({ prisma: client });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('already CLOSED custody'))).toBe(true);
    expect(result.failures).not.toHaveLength(0);
  });

  it('9. rejects reversal voucher missing reversalOfVoucherId', async () => {
    // Arrange
    const { client } = createMockPrisma({
      ledgers: [
        {
          id: 'rev-missing-ref',
          voucherNumber: '#REV-MISSING-01',
          isReversal: true,
          reversalOfVoucherId: '',
        },
      ],
    });

    // Act
    const result = await verifyFinancialIntegrity({ prisma: client });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('missing reversalOfVoucherId'))).toBe(true);
    expect(result.failures).not.toHaveLength(0);
  });

  it('10. rejects reversal voucher referencing itself', async () => {
    // Arrange
    const { client } = createMockPrisma({
      ledgers: [
        {
          id: 'rev-self',
          voucherNumber: '#REV-SELF-01',
          isReversal: true,
          reversalOfVoucherId: '#REV-SELF-01',
        },
      ],
    });

    // Act
    const result = await verifyFinancialIntegrity({ prisma: client });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('cannot be a reversal of itself'))).toBe(true);
    expect(result.failures).not.toHaveLength(0);
  });

  it('11. rejects reversal voucher referencing non-existent original voucher', async () => {
    // Arrange
    const { client } = createMockPrisma({
      ledgers: [
        {
          id: 'rev-ghost',
          voucherNumber: '#REV-GHOST-01',
          isReversal: true,
          reversalOfVoucherId: '#VOUCHER-DOES-NOT-EXIST',
        },
      ],
    });

    // Act
    const result = await verifyFinancialIntegrity({ prisma: client });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('references non-existent original voucher'))).toBe(true);
    expect(result.failures).not.toHaveLength(0);
  });
});
