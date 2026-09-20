import { describe, it, expect } from 'vitest';
import {
  type PositiveFiniteAmount,
  type SafeFinancialQuantity,
  toPositiveFiniteAmount,
  toSafeFinancialQuantity,
  validateAmount,
  UniversalCustodyGate,
  verifyCustodyBalance,
  TripleBalanceClearingEngine,
  UniversalInstallmentEngine,
  UniversalShiftAccrualEngine,
  STANDARD_SHIFT_PRESETS,
} from '../src/index.js';
import type { CustodyAccount } from '../src/custody-gate/types.js';

describe('Tier 1: Branded Nominal Types & Boundary Gate Tests', () => {
  describe('toPositiveFiniteAmount', () => {
    it('accepts valid positive numbers', () => {
      const intAmount: PositiveFiniteAmount = toPositiveFiniteAmount(100);
      expect(intAmount).toBe(100);

      const floatAmount = toPositiveFiniteAmount(49.95);
      expect(floatAmount).toBe(49.95);

      const decimalObj = { toNumber: () => 125.75 };
      const fromObj = toPositiveFiniteAmount(decimalObj);
      expect(fromObj).toBe(125.75);
    });

    it('accepts valid Arabic/Eastern string numerals', () => {
      const arabicIndic = toPositiveFiniteAmount('١٥٠٠');
      expect(arabicIndic).toBe(1500);

      const arabicDecimal = toPositiveFiniteAmount('٢٥٠٫٥٠');
      expect(arabicDecimal).toBe(250.5);

      const westernString = toPositiveFiniteAmount('500');
      expect(westernString).toBe(500);

      const formattedArabic = toPositiveFiniteAmount(' ١٬٥٠٠ ');
      expect(formattedArabic).toBe(1500);
    });

    it('rejects 0 with boundary violation', () => {
      expect(() => toPositiveFiniteAmount(0)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount('0')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount('٠')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount({ toNumber: () => 0 })).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
    });

    it('rejects negative numbers', () => {
      expect(() => toPositiveFiniteAmount(-1)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(-500.25)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount('-100')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount('-٥٠')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount({ toNumber: () => -50 })).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
    });

    it('rejects NaN', () => {
      expect(() => toPositiveFiniteAmount(NaN)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(Number.NaN)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount({ toNumber: () => NaN })).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
    });

    it('rejects Infinity and -Infinity', () => {
      expect(() => toPositiveFiniteAmount(Infinity)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(-Infinity)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount('Infinity')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount('-Infinity')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount({ toNumber: () => Infinity })).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
    });

    it('rejects non-numeric strings with BOUNDARY_DESERIALIZATION_VIOLATION', () => {
      expect(() => toPositiveFiniteAmount('abc')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount('')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount('   ')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount('abc123')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(null)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(undefined)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
    });
  });

  describe('toSafeFinancialQuantity', () => {
    it('accepts valid quantities', () => {
      const intQty: SafeFinancialQuantity = toSafeFinancialQuantity(10);
      expect(intQty).toBe(10);

      const floatQty = toSafeFinancialQuantity(2.5);
      expect(floatQty).toBe(2.5);

      const arabicQty = toSafeFinancialQuantity('١٥');
      expect(arabicQty).toBe(15);

      const decimalObj = { toNumber: () => 7 };
      expect(toSafeFinancialQuantity(decimalObj)).toBe(7);
    });

    it('rejects 0, negative, NaN, and Infinity', () => {
      expect(() => toSafeFinancialQuantity(0)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity('0')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity('٠')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity(-5)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity('-10')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity(NaN)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity(Infinity)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity(-Infinity)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
    });

    it('rejects non-numeric strings, empty inputs, and invalid objects', () => {
      expect(() => toSafeFinancialQuantity('xyz')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity('')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity('   ')).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity(null)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity(undefined)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity({ toNumber: () => 0 })).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity({ toNumber: () => -5 })).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity({ toNumber: () => NaN })).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toSafeFinancialQuantity({ toNumber: () => Infinity })).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
    });
  });

  describe('validateAmount with branded types', () => {
    it('returns branded PositiveFiniteAmount on valid input', () => {
      const res = validateAmount(1500);
      expect(res.isValid).toBe(true);
      expect(res.amount).toBe(1500);
      const validatedBranded: PositiveFiniteAmount = res.amount!;
      expect(validatedBranded).toBe(1500);

      const resArabic = validateAmount('٢٥٠٠');
      expect(resArabic.isValid).toBe(true);
      expect(resArabic.amount).toBe(2500);
    });

    it('rejects 0, negative, NaN, Infinity, -Infinity, and non-numeric strings', () => {
      const resZero = validateAmount(0);
      expect(resZero.isValid).toBe(false);
      expect(resZero.error).toBeDefined();

      const resNeg = validateAmount(-50);
      expect(resNeg.isValid).toBe(false);
      expect(resNeg.error).toBeDefined();

      const resNan = validateAmount(NaN);
      expect(resNan.isValid).toBe(false);
      expect(resNan.error).toBeDefined();

      const resInf = validateAmount(Infinity);
      expect(resInf.isValid).toBe(false);

      const resNegInf = validateAmount(-Infinity);
      expect(resNegInf.isValid).toBe(false);

      const resStrInf = validateAmount('Infinity');
      expect(resStrInf.isValid).toBe(false);

      const resStrInvalid = validateAmount('not-a-number');
      expect(resStrInvalid.isValid).toBe(false);
    });
  });

  describe('UniversalCustodyGate NaN/Infinity protection', () => {
    const mockCustody: CustodyAccount = {
      id: 'cust-test-1',
      code: 'CUST-01',
      supervisorTelegramId: 123456n,
      supervisorName: 'مشرف الاختبار',
      siteCode: 'STE-TEST',
      currentBalance: 10000,
      status: 'OPEN',
    };

    it('allows valid PositiveFiniteAmount and calculates correct projected balance', () => {
      const validAmount = toPositiveFiniteAmount(2500);
      const validRes = UniversalCustodyGate.verifyCustodyFunds({
        custody: mockCustody,
        requiredAmount: validAmount,
        operationType: 'شراء مهمات',
      });
      expect(validRes.isAllowed).toBe(true);
      expect(validRes.projectedBalance).toBe(7500);

      // Verify alias verifyCustodyBalance behaves identically
      const aliasRes = verifyCustodyBalance({
        custody: mockCustody,
        requiredAmount: validAmount,
        operationType: 'شراء مهمات',
      });
      expect(aliasRes.isAllowed).toBe(true);
      expect(aliasRes.projectedBalance).toBe(7500);
    });

    it('rejects NaN or Infinity in requiredAmount across UniversalCustodyGate and verifyCustodyBalance', () => {
      const resNan = UniversalCustodyGate.verifyCustodyFunds({
        custody: mockCustody,
        requiredAmount: NaN,
        operationType: 'اختبار',
      });
      expect(resNan.isAllowed).toBe(false);
      expect(resNan.error).toBe('INVALID_AMOUNT');

      const resInf = UniversalCustodyGate.verifyCustodyFunds({
        custody: mockCustody,
        requiredAmount: Infinity,
        operationType: 'اختبار',
      });
      expect(resInf.isAllowed).toBe(false);
      expect(resInf.error).toBe('INVALID_AMOUNT');

      // Check alias verifyCustodyBalance directly with NaN, Infinity, -Infinity, and <= 0
      const aliasNan = verifyCustodyBalance({
        custody: mockCustody,
        requiredAmount: NaN,
        operationType: 'اختبار',
      });
      expect(aliasNan.isAllowed).toBe(false);
      expect(aliasNan.error).toBe('INVALID_AMOUNT');

      const aliasInf = verifyCustodyBalance({
        custody: mockCustody,
        requiredAmount: Infinity,
        operationType: 'اختبار',
      });
      expect(aliasInf.isAllowed).toBe(false);
      expect(aliasInf.error).toBe('INVALID_AMOUNT');

      const aliasNegInf = verifyCustodyBalance({
        custody: mockCustody,
        requiredAmount: -Infinity,
        operationType: 'اختبار',
      });
      expect(aliasNegInf.isAllowed).toBe(false);
      expect(aliasNegInf.error).toBe('INVALID_AMOUNT');

      const aliasZero = verifyCustodyBalance({
        custody: mockCustody,
        requiredAmount: 0,
        operationType: 'اختبار',
      });
      expect(aliasZero.isAllowed).toBe(false);
      expect(aliasZero.error).toBe('INVALID_AMOUNT');

      const aliasNeg = verifyCustodyBalance({
        custody: mockCustody,
        requiredAmount: -500,
        operationType: 'اختبار',
      });
      expect(aliasNeg.isAllowed).toBe(false);
      expect(aliasNeg.error).toBe('INVALID_AMOUNT');
    });

    it('rejects non-finite custody currentBalance', () => {
      const mockCustodyNan: CustodyAccount = {
        ...mockCustody,
        currentBalance: NaN,
      };
      const resNan = UniversalCustodyGate.verifyCustodyFunds({
        custody: mockCustodyNan,
        requiredAmount: toPositiveFiniteAmount(500),
        operationType: 'اختبار',
      });
      expect(resNan.isAllowed).toBe(false);
      expect(resNan.error).toBe('INVALID_CUSTODY_BALANCE');

      const mockCustodyInf: CustodyAccount = {
        ...mockCustody,
        currentBalance: Infinity,
      };
      const resInf = verifyCustodyBalance({
        custody: mockCustodyInf,
        requiredAmount: toPositiveFiniteAmount(500),
        operationType: 'اختبار',
      });
      expect(resInf.isAllowed).toBe(false);
      expect(resInf.error).toBe('INVALID_CUSTODY_BALANCE');

      const mockCustodyNegInf: CustodyAccount = {
        ...mockCustody,
        currentBalance: -Infinity,
      };
      const resNegInf = verifyCustodyBalance({
        custody: mockCustodyNegInf,
        requiredAmount: toPositiveFiniteAmount(500),
        operationType: 'اختبار',
      });
      expect(resNegInf.isAllowed).toBe(false);
      expect(resNegInf.error).toBe('INVALID_CUSTODY_BALANCE');
    });
  });

  describe('TripleBalanceClearingEngine NaN/Infinity protection', () => {
    it('rejects NaN/Infinity/negative in cigarette clearing', () => {
      const validRes = TripleBalanceClearingEngine.processCigaretteClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        workerName: 'علي',
        brandName: 'كليوباترا',
        packPrice: toPositiveFiniteAmount(50),
        packsCount: 2,
        siteCode: 'STE-01',
        canteenStockAvailable: 10,
      });
      expect(validRes.success).toBe(true);
      expect(validRes.totalAmount).toBe(100);

      const resNanPrice = TripleBalanceClearingEngine.processCigaretteClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        workerName: 'علي',
        brandName: 'كليوباترا',
        packPrice: NaN,
        packsCount: 2,
        siteCode: 'STE-01',
        canteenStockAvailable: 10,
      });
      expect(resNanPrice.success).toBe(false);
      expect(resNanPrice.error).toBe('INVALID_PACK_COUNT_OR_PRICE');

      const resInfPrice = TripleBalanceClearingEngine.processCigaretteClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        workerName: 'علي',
        brandName: 'كليوباترا',
        packPrice: Infinity,
        packsCount: 2,
        siteCode: 'STE-01',
        canteenStockAvailable: 10,
      });
      expect(resInfPrice.success).toBe(false);
      expect(resInfPrice.error).toBe('INVALID_PACK_COUNT_OR_PRICE');

      const resNegPrice = TripleBalanceClearingEngine.processCigaretteClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        workerName: 'علي',
        brandName: 'كليوباترا',
        packPrice: -50,
        packsCount: 2,
        siteCode: 'STE-01',
        canteenStockAvailable: 10,
      });
      expect(resNegPrice.success).toBe(false);
      expect(resNegPrice.error).toBe('INVALID_PACK_COUNT_OR_PRICE');

      const resInfCount = TripleBalanceClearingEngine.processCigaretteClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        workerName: 'علي',
        brandName: 'كليوباترا',
        packPrice: 50,
        packsCount: Infinity,
        siteCode: 'STE-01',
        canteenStockAvailable: 10,
      });
      expect(resInfCount.success).toBe(false);
      expect(resInfCount.error).toBe('INVALID_PACK_COUNT_OR_PRICE');

      const resNanCount = TripleBalanceClearingEngine.processCigaretteClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        workerName: 'علي',
        brandName: 'كليوباترا',
        packPrice: 50,
        packsCount: NaN,
        siteCode: 'STE-01',
        canteenStockAvailable: 10,
      });
      expect(resNanCount.success).toBe(false);
      expect(resNanCount.error).toBe('INVALID_PACK_COUNT_OR_PRICE');

      const resZeroCount = TripleBalanceClearingEngine.processCigaretteClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        workerName: 'علي',
        brandName: 'كليوباترا',
        packPrice: 50,
        packsCount: 0,
        siteCode: 'STE-01',
        canteenStockAvailable: 10,
      });
      expect(resZeroCount.success).toBe(false);
      expect(resZeroCount.error).toBe('INVALID_PACK_COUNT_OR_PRICE');
    });

    it('rejects NaN/Infinity/negative in supplier purchase clearing', () => {
      const validRes = TripleBalanceClearingEngine.processSupplierPurchaseClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        supplierId: 'sup-1',
        supplierName: 'مورد معتمد',
        itemDescription: 'مستلزمات',
        purchaseAmount: toPositiveFiniteAmount(300),
        siteCode: 'STE-01',
        vendorPayableAvailable: 2000,
      });
      expect(validRes.success).toBe(true);
      expect(validRes.totalAmount).toBe(300);

      const resNan = TripleBalanceClearingEngine.processSupplierPurchaseClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        supplierId: 'sup-1',
        supplierName: 'مورد معتمد',
        itemDescription: 'مستلزمات',
        purchaseAmount: NaN,
        siteCode: 'STE-01',
        vendorPayableAvailable: 2000,
      });
      expect(resNan.success).toBe(false);
      expect(resNan.error).toBe('INVALID_PURCHASE_AMOUNT');

      const resInf = TripleBalanceClearingEngine.processSupplierPurchaseClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        supplierId: 'sup-1',
        supplierName: 'مورد معتمد',
        itemDescription: 'مستلزمات',
        purchaseAmount: Infinity,
        siteCode: 'STE-01',
        vendorPayableAvailable: 2000,
      });
      expect(resInf.success).toBe(false);
      expect(resInf.error).toBe('INVALID_PURCHASE_AMOUNT');

      const resNegInf = TripleBalanceClearingEngine.processSupplierPurchaseClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        supplierId: 'sup-1',
        supplierName: 'مورد معتمد',
        itemDescription: 'مستلزمات',
        purchaseAmount: -Infinity,
        siteCode: 'STE-01',
        vendorPayableAvailable: 2000,
      });
      expect(resNegInf.success).toBe(false);
      expect(resNegInf.error).toBe('INVALID_PURCHASE_AMOUNT');

      const resZero = TripleBalanceClearingEngine.processSupplierPurchaseClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        supplierId: 'sup-1',
        supplierName: 'مورد معتمد',
        itemDescription: 'مستلزمات',
        purchaseAmount: 0,
        siteCode: 'STE-01',
        vendorPayableAvailable: 2000,
      });
      expect(resZero.success).toBe(false);
      expect(resZero.error).toBe('INVALID_PURCHASE_AMOUNT');

      const resNeg = TripleBalanceClearingEngine.processSupplierPurchaseClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        supplierId: 'sup-1',
        supplierName: 'مورد معتمد',
        itemDescription: 'مستلزمات',
        purchaseAmount: -250,
        siteCode: 'STE-01',
        vendorPayableAvailable: 2000,
      });
      expect(resNeg.success).toBe(false);
      expect(resNeg.error).toBe('INVALID_PURCHASE_AMOUNT');
    });

    it('rejects NaN/Infinity/negative in cash advance clearing', () => {
      const validRes = TripleBalanceClearingEngine.processCashAdvanceClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        requestedAmount: toPositiveFiniteAmount(500),
        sourceOfFunds: 'SITE_CUSTODY',
        sourceEntityId: 'cust-1',
        sourceEntityName: 'عهدة الموقع',
        availableBalance: 2000,
      });
      expect(validRes.success).toBe(true);
      expect(validRes.approvedAmount).toBe(500);

      const resNan = TripleBalanceClearingEngine.processCashAdvanceClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        requestedAmount: NaN,
        sourceOfFunds: 'SITE_CUSTODY',
        sourceEntityId: 'cust-1',
        sourceEntityName: 'عهدة الموقع',
        availableBalance: 2000,
      });
      expect(resNan.success).toBe(false);
      expect(resNan.approvedAmount).toBe(0);

      const resInfReq = TripleBalanceClearingEngine.processCashAdvanceClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        requestedAmount: Infinity,
        sourceOfFunds: 'SITE_CUSTODY',
        sourceEntityId: 'cust-1',
        sourceEntityName: 'عهدة الموقع',
        availableBalance: 2000,
      });
      expect(resInfReq.success).toBe(false);
      expect(resInfReq.approvedAmount).toBe(0);

      const resNegInfReq = TripleBalanceClearingEngine.processCashAdvanceClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        requestedAmount: -Infinity,
        sourceOfFunds: 'SITE_CUSTODY',
        sourceEntityId: 'cust-1',
        sourceEntityName: 'عهدة الموقع',
        availableBalance: 2000,
      });
      expect(resNegInfReq.success).toBe(false);
      expect(resNegInfReq.approvedAmount).toBe(0);

      const resZeroReq = TripleBalanceClearingEngine.processCashAdvanceClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        requestedAmount: 0,
        sourceOfFunds: 'SITE_CUSTODY',
        sourceEntityId: 'cust-1',
        sourceEntityName: 'عهدة الموقع',
        availableBalance: 2000,
      });
      expect(resZeroReq.success).toBe(false);
      expect(resZeroReq.approvedAmount).toBe(0);

      const resNegReq = TripleBalanceClearingEngine.processCashAdvanceClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        requestedAmount: -300,
        sourceOfFunds: 'SITE_CUSTODY',
        sourceEntityId: 'cust-1',
        sourceEntityName: 'عهدة الموقع',
        availableBalance: 2000,
      });
      expect(resNegReq.success).toBe(false);
      expect(resNegReq.approvedAmount).toBe(0);

      const resInfBal = TripleBalanceClearingEngine.processCashAdvanceClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        requestedAmount: toPositiveFiniteAmount(500),
        sourceOfFunds: 'SITE_CUSTODY',
        sourceEntityId: 'cust-1',
        sourceEntityName: 'عهدة الموقع',
        availableBalance: Infinity,
      });
      expect(resInfBal.success).toBe(false);

      const resNanBal = TripleBalanceClearingEngine.processCashAdvanceClearing({
        workerId: 'w-1',
        workerCode: 'OP-01',
        requestedAmount: toPositiveFiniteAmount(500),
        sourceOfFunds: 'SITE_CUSTODY',
        sourceEntityId: 'cust-1',
        sourceEntityName: 'عهدة الموقع',
        availableBalance: NaN,
      });
      expect(resNanBal.success).toBe(false);
    });
  });

  describe('UniversalInstallmentEngine NaN/Infinity protection', () => {
    it('calculates plan with valid PositiveFiniteAmount', () => {
      const validRes = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-1',
        totalAmount: toPositiveFiniteAmount(1200),
        installmentsCount: 3,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      });
      expect(validRes.isValid).toBe(true);
      expect(validRes.installments.length).toBe(3);
    });

    it('rejects NaN, Infinity, and non-positive totalAmount', () => {
      const resNan = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-1',
        totalAmount: NaN,
        installmentsCount: 3,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      });
      expect(resNan.isValid).toBe(false);
      expect(resNan.errorArabic).toContain('أرقاماً موجبة');

      const resInf = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-1',
        totalAmount: Infinity,
        installmentsCount: 3,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      });
      expect(resInf.isValid).toBe(false);

      const resNegInf = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-1',
        totalAmount: -Infinity,
        installmentsCount: 3,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      });
      expect(resNegInf.isValid).toBe(false);

      const resZero = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-1',
        totalAmount: 0,
        installmentsCount: 3,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      });
      expect(resZero.isValid).toBe(false);

      const resNeg = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-1',
        totalAmount: -500,
        installmentsCount: 3,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      });
      expect(resNeg.isValid).toBe(false);
    });

    it('rejects NaN, Infinity, zero, negative, and fractional installmentsCount', () => {
      const resNanCount = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-1',
        totalAmount: toPositiveFiniteAmount(1000),
        installmentsCount: NaN,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      });
      expect(resNanCount.isValid).toBe(false);

      const resInfCount = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-1',
        totalAmount: toPositiveFiniteAmount(1000),
        installmentsCount: Infinity,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      });
      expect(resInfCount.isValid).toBe(false);

      const resZeroCount = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-1',
        totalAmount: toPositiveFiniteAmount(1000),
        installmentsCount: 0,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      });
      expect(resZeroCount.isValid).toBe(false);

      const resNegCount = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-1',
        totalAmount: toPositiveFiniteAmount(1000),
        installmentsCount: -2,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      });
      expect(resNegCount.isValid).toBe(false);

      const resFloatCount = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-1',
        totalAmount: toPositiveFiniteAmount(1000),
        installmentsCount: 2.5,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      });
      expect(resFloatCount.isValid).toBe(false);
    });
  });

  describe('UniversalShiftAccrualEngine bounds presenceDays', () => {
    it('bounds NaN and negative presenceDays to 0', () => {
      const resNan = UniversalShiftAccrualEngine.calculateAccrual({
        workerId: 'w-1',
        presenceDays: NaN,
        cycleConfig: STANDARD_SHIFT_PRESETS.STANDARD_20_10,
      });
      expect(resNan.presenceDays).toBe(0);
      expect(resNan.earnedRestDaysExact).toBe(0);

      const resNeg = UniversalShiftAccrualEngine.calculateAccrual({
        workerId: 'w-1',
        presenceDays: -15,
        cycleConfig: STANDARD_SHIFT_PRESETS.STANDARD_20_10,
      });
      expect(resNeg.presenceDays).toBe(0);
      expect(resNeg.earnedRestDaysExact).toBe(0);
    });

    it('clamps presenceDays exceeding 366', () => {
      const resOver = UniversalShiftAccrualEngine.calculateAccrual({
        workerId: 'w-1',
        presenceDays: 500,
        cycleConfig: STANDARD_SHIFT_PRESETS.STANDARD_20_10,
      });
      expect(resOver.presenceDays).toBe(366);
      expect(resOver.earnedRestDaysExact).toBe(183);

      const resNormal = UniversalShiftAccrualEngine.calculateAccrual({
        workerId: 'w-1',
        presenceDays: 20,
        cycleConfig: STANDARD_SHIFT_PRESETS.STANDARD_20_10,
      });
      expect(resNormal.presenceDays).toBe(20);
      expect(resNormal.earnedRestDaysExact).toBe(10);
    });
  });
});