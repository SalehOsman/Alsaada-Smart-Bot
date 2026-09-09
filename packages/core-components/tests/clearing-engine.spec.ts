import { describe, it, expect } from 'vitest';
import { TripleBalanceClearingEngine } from '../src/clearing-engine/clearing.js';

describe('Triple Balance Clearing Engine — Tests', () => {
  it('should clear in-kind cigarettes: stock deducted, site expense reduced, exactly 0 cash outflow', () => {
    const res = TripleBalanceClearingEngine.processCigaretteClearing({
      workerId: 'w-1',
      workerCode: 'OP-01',
      workerName: 'علي أحمد',
      brandName: 'كليوباترا بوكس',
      packPrice: 45,
      packsCount: 10,
      siteCode: 'STE-KHA',
      canteenStockAvailable: 50,
    });

    expect(res.success).toBe(true);
    expect(res.totalAmount).toBe(450);
    expect(res.cashOutflow).toBe(0); // Strict 0 cash
    expect(res.canteenStockDeduction).toBe(10);
    expect(res.siteExpenseReduction).toBe(450);
    expect(res.clearingSummaryArabic).toContain('خصم (10) علبة');
  });

  it('should reject cigarette clearing if canteen stock is insufficient', () => {
    const res = TripleBalanceClearingEngine.processCigaretteClearing({
      workerId: 'w-1',
      workerCode: 'OP-01',
      workerName: 'علي أحمد',
      brandName: 'كليوباترا بوكس',
      packPrice: 45,
      packsCount: 20,
      siteCode: 'STE-KHA',
      canteenStockAvailable: 5,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('INSUFFICIENT_CANTEEN_STOCK');
  });

  it('should clear in-kind supplier purchase: payable offset, exactly 0 cash outflow', () => {
    const res = TripleBalanceClearingEngine.processSupplierPurchaseClearing({
      workerId: 'w-2',
      workerCode: 'OP-02',
      supplierId: 'sup-1',
      supplierName: 'سوبرماركت الأمانة',
      itemDescription: 'كرتونة مياه + معلبات',
      purchaseAmount: 350,
      siteCode: 'STE-KHA',
      vendorPayableAvailable: 5000,
    });

    expect(res.success).toBe(true);
    expect(res.totalAmount).toBe(350);
    expect(res.cashOutflow).toBe(0); // Strict 0 cash
    expect(res.vendorPayableOffset).toBe(350);
    expect(res.clearingSummaryArabic).toContain('تخفيض مطالبات المورد');
  });

  it('should approve cash advance with real cash outflow and update source balance', () => {
    const res = TripleBalanceClearingEngine.processCashAdvanceClearing({
      workerId: 'w-3',
      workerCode: 'OP-03',
      requestedAmount: 1000,
      sourceOfFunds: 'SITE_CUSTODY',
      sourceEntityId: 'cust-10',
      sourceEntityName: 'عهدة المهندس محمد',
      availableBalance: 8500,
    });

    expect(res.success).toBe(true);
    expect(res.approvedAmount).toBe(1000);
    expect(res.cashOutflow).toBe(1000); // Real cash out
    expect(res.remainingSourceBalance).toBe(7500);
  });

  it('should reject cash advance if available balance is less than requested amount', () => {
    const res = TripleBalanceClearingEngine.processCashAdvanceClearing({
      workerId: 'w-3',
      workerCode: 'OP-03',
      requestedAmount: 5000,
      sourceOfFunds: 'SITE_CUSTODY',
      sourceEntityId: 'cust-10',
      sourceEntityName: 'عهدة المهندس محمد',
      availableBalance: 1200,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('INSUFFICIENT_FUNDS');
  });
});
