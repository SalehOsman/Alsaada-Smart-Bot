import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TripleBalanceClearingEngine } from '../src/clearing-engine/clearing.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Triple Balance Clearing Engine — Tests', () => {
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

  it('1. clears in-kind cigarettes: stock deducted, site expense reduced, exactly 0 cash outflow', () => {
    // Arrange
    const params = {
      workerId: 'w-1',
      workerCode: 'OP-01',
      workerName: 'علي أحمد',
      brandName: 'كليوباترا بوكس',
      packPrice: 45,
      packsCount: 10,
      siteCode: 'STE-KHA',
      canteenStockAvailable: 50,
    };

    // Act
    const res = TripleBalanceClearingEngine.processCigaretteClearing(params);

    // Assert
    expect(res.success).toBe(true);
    expect(res.totalAmount).toBe(450);
    expect(res.cashOutflow).toBe(0); // Strict 0 cash
    expect(res.canteenStockDeduction).toBe(10);
    expect(res.siteExpenseReduction).toBe(450);
    expect(res.clearingSummaryArabic).toContain('خصم (10) علبة');
  });

  it('2. rejects cigarette clearing if canteen stock is insufficient', () => {
    // Arrange
    const params = {
      workerId: 'w-1',
      workerCode: 'OP-01',
      workerName: 'علي أحمد',
      brandName: 'كليوباترا بوكس',
      packPrice: 45,
      packsCount: 20,
      siteCode: 'STE-KHA',
      canteenStockAvailable: 5,
    };

    // Act
    const res = TripleBalanceClearingEngine.processCigaretteClearing(params);

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toBe('INSUFFICIENT_CANTEEN_STOCK');
  });

  it('3. clears in-kind supplier purchase: payable offset, exactly 0 cash outflow', () => {
    // Arrange
    const params = {
      workerId: 'w-2',
      workerCode: 'OP-02',
      supplierId: 'sup-1',
      supplierName: 'سوبرماركت الأمانة',
      itemDescription: 'كرتونة مياه + معلبات',
      purchaseAmount: 350,
      siteCode: 'STE-KHA',
      vendorPayableAvailable: 5000,
    };

    // Act
    const res = TripleBalanceClearingEngine.processSupplierPurchaseClearing(params);

    // Assert
    expect(res.success).toBe(true);
    expect(res.totalAmount).toBe(350);
    expect(res.cashOutflow).toBe(0); // Strict 0 cash
    expect(res.vendorPayableOffset).toBe(350);
    expect(res.clearingSummaryArabic).toContain('تخفيض مطالبات المورد');
  });

  it('4. approves cash advance with real cash outflow and updates source balance', () => {
    // Arrange
    const params = {
      workerId: 'w-3',
      workerCode: 'OP-03',
      requestedAmount: 1000,
      sourceOfFunds: 'SITE_CUSTODY' as const,
      sourceEntityId: 'cust-10',
      sourceEntityName: 'عهدة المهندس محمد',
      availableBalance: 8500,
    };

    // Act
    const res = TripleBalanceClearingEngine.processCashAdvanceClearing(params);

    // Assert
    expect(res.success).toBe(true);
    expect(res.approvedAmount).toBe(1000);
    expect(res.cashOutflow).toBe(1000); // Real cash out
    expect(res.remainingSourceBalance).toBe(7500);
  });

  it('5. rejects cash advance if available balance is less than requested amount', () => {
    // Arrange
    const params = {
      workerId: 'w-3',
      workerCode: 'OP-03',
      requestedAmount: 5000,
      sourceOfFunds: 'SITE_CUSTODY' as const,
      sourceEntityId: 'cust-10',
      sourceEntityName: 'عهدة المهندس محمد',
      availableBalance: 1200,
    };

    // Act
    const res = TripleBalanceClearingEngine.processCashAdvanceClearing(params);

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toBe('INSUFFICIENT_FUNDS');
  });
});
