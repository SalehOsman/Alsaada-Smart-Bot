import { describe, expect, it, vi } from 'vitest';
import { cleanupFinancialTestFixtures } from '../verify-financial-integrity.js';

describe('🏛️ INC-20260923-FINANCIAL-CLEANUP: Regression Tests for Ephemeral Cleanup', () => {
  it('1. executes raw SQL cleanup queries with valid schema columns and correct fixture prefixes', async () => {
    // Arrange
    const executedRawQueries: string[] = [];
    const mockClientWithRaw: any = {
      $executeRawUnsafe: vi.fn().mockImplementation((query: string) => {
        executedRawQueries.push(query);
        return Promise.resolve(1);
      }),
    };

    // Act
    await cleanupFinancialTestFixtures(mockClientWithRaw);

    // Assert: Check raw SQL queries match schema.prisma models
    expect(mockClientWithRaw.$executeRawUnsafe).toHaveBeenCalled();

    // 1. HospitalityExpense: column must be voucherId, not voucherNumber
    const hospQuery = executedRawQueries.find((q) => q.includes('"hospitality_expenses"'));
    expect(hospQuery).toBeDefined();
    expect(hospQuery).toContain('"voucherId"');
    expect(hospQuery).not.toContain('"voucherNumber"');
    expect(hospQuery).toContain('#HOSP-GOV-2026-%');

    // 2. SupplierPayment: column must be paymentNumber, not paymentVoucher
    const spayQuery = executedRawQueries.find((q) => q.includes('"supplier_payments"'));
    expect(spayQuery).toBeDefined();
    expect(spayQuery).toContain('"paymentNumber"');
    expect(spayQuery).not.toContain('"paymentVoucher"');
    expect(spayQuery).toContain('#SPAY-GOV-2026-%');

    // 3. CustodyExpenseItem: must link via custodyId, not non-existent receiptNumber
    const itemQuery = executedRawQueries.find((q) => q.includes('"custody_expense_items"'));
    expect(itemQuery).toBeDefined();
    expect(itemQuery).toContain('"custodyId"');
    expect(itemQuery).not.toContain('"receiptNumber"');

    // 4. FinancialLedger: must target #ADV-GOV- prefix
    const ledgerQuery = executedRawQueries.find((q) => q.includes('"financial_ledgers"'));
    expect(ledgerQuery).toBeDefined();
    expect(ledgerQuery).toContain('#ADV-GOV-%');

    // 5. CustodySettlement: must target #SET-GOV- prefix
    const setQuery = executedRawQueries.find((q) => q.includes('"custody_settlements"'));
    expect(setQuery).toBeDefined();
    expect(setQuery).toContain('#SET-GOV-2026-%');
  });

  it('2. executes Prisma Client fallback branch with matching model fields and prefixes', async () => {
    // Arrange
    const mockClientPrisma: any = {
      workerExpenseClaim: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      hospitalityExpense: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      custodyExpenseItem: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      custodySettlement: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      supplierPayment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      financialLedger: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      financialCustody: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      worker: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      supplier: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      site: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      project: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      tenant: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };

    // Act
    await cleanupFinancialTestFixtures(mockClientPrisma);

    // Assert: Verify deleteMany invocations
    expect(mockClientPrisma.hospitalityExpense.deleteMany).toHaveBeenCalledWith({
      where: { voucherId: { startsWith: '#HOSP-GOV-2026-' } },
    });
    expect(mockClientPrisma.supplierPayment.deleteMany).toHaveBeenCalledWith({
      where: { paymentNumber: { startsWith: '#SPAY-GOV-2026-' } },
    });
    expect(mockClientPrisma.custodyExpenseItem.deleteMany).toHaveBeenCalledWith({
      where: { custody: { custodyNumber: { startsWith: 'CUST-GOV-2026-' } } },
    });
    expect(mockClientPrisma.custodySettlement.deleteMany).toHaveBeenCalledWith({
      where: { settlementNumber: { startsWith: '#SET-GOV-2026-' } },
    });
    expect(mockClientPrisma.financialLedger.deleteMany).toHaveBeenCalledWith({
      where: { voucherNumber: { startsWith: '#ADV-GOV-' } },
    });
  });

  it('3. safely handles null or undefined client without crashing', async () => {
    await expect(cleanupFinancialTestFixtures(null)).resolves.toBeUndefined();
    await expect(cleanupFinancialTestFixtures(undefined)).resolves.toBeUndefined();
  });
});
