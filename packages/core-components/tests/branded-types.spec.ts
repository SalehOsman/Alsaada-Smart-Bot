import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Tier 1: Branded Nominal Types & Boundary Gate Tests', () => {
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

  describe('toPositiveFiniteAmount', () => {
    it('1. accepts valid positive numbers', () => {
      // Arrange
      const rawInt = 100;
      const rawFloat = 49.95;
      const decimalObj = { toNumber: () => 125.75 };

      // Act
      const intAmount: PositiveFiniteAmount = toPositiveFiniteAmount(rawInt);
      const floatAmount = toPositiveFiniteAmount(rawFloat);
      const fromObj = toPositiveFiniteAmount(decimalObj);

      // Assert
      expect(intAmount).toBe(100);
      expect(floatAmount).toBe(49.95);
      expect(fromObj).toBe(125.75);
    });

    it('2. accepts valid Arabic/Eastern string numerals', () => {
      // Arrange
      const arabicIndicStr = '١٥٠٠';
      const arabicDecimalStr = '٢٥٠٫٥٠';
      const westernStr = '500';
      const formattedArabicStr = ' ١٬٥٠٠ ';

      // Act
      const arabicIndic = toPositiveFiniteAmount(arabicIndicStr);
      const arabicDecimal = toPositiveFiniteAmount(arabicDecimalStr);
      const westernString = toPositiveFiniteAmount(westernStr);
      const formattedArabic = toPositiveFiniteAmount(formattedArabicStr);

      // Assert
      expect(arabicIndic).toBe(1500);
      expect(arabicDecimal).toBe(250.5);
      expect(westernString).toBe(500);
      expect(formattedArabic).toBe(1500);
    });

    it('3. rejects 0 with boundary violation', () => {
      // Arrange
      const zeroVal = 0;
      const zeroStr = '0';
      const zeroEastern = '٠';
      const zeroObj = { toNumber: () => 0 };

      // Act & Assert
      // Assert
      expect(() => toPositiveFiniteAmount(zeroVal)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(zeroStr)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(zeroEastern)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(zeroObj)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
    });

    it('4. rejects negative numbers', () => {
      // Arrange
      const negVal = -1;
      const negFloat = -500.25;
      const negStr = '-100';
      const negEastern = '-٥٠';
      const negObj = { toNumber: () => -50 };

      // Act & Assert
      // Assert
      expect(() => toPositiveFiniteAmount(negVal)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(negFloat)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(negStr)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(negEastern)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(negObj)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
    });

    it('5. rejects NaN', () => {
      // Arrange
      const nanVal = NaN;
      const numNan = Number.NaN;
      const nanObj = { toNumber: () => NaN };

      // Act & Assert
      // Assert
      expect(() => toPositiveFiniteAmount(nanVal)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(numNan)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(nanObj)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
    });

    it('6. rejects Infinity and -Infinity', () => {
      // Arrange
      const infVal = Infinity;
      const negInfVal = -Infinity;
      const infStr = 'Infinity';
      const negInfStr = '-Infinity';
      const infObj = { toNumber: () => Infinity };

      // Act & Assert
      // Assert
      expect(() => toPositiveFiniteAmount(infVal)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(negInfVal)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(infStr)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(negInfStr)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      expect(() => toPositiveFiniteAmount(infObj)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
    });

    it('7. rejects non-numeric strings with BOUNDARY_DESERIALIZATION_VIOLATION', () => {
      // Arrange
      const invalidVals: unknown[] = ['abc', '', '   ', 'abc123', null, undefined];

      // Act & Assert
      // Assert
      for (const val of invalidVals) {
        expect(() => toPositiveFiniteAmount(val)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      }
    });
  });

  describe('toSafeFinancialQuantity', () => {
    it('8. accepts valid quantities', () => {
      // Arrange
      const rawInt = 10;
      const rawFloat = 2.5;
      const rawArabic = '١٥';
      const decimalObj = { toNumber: () => 7 };

      // Act
      const intQty: SafeFinancialQuantity = toSafeFinancialQuantity(rawInt);
      const floatQty = toSafeFinancialQuantity(rawFloat);
      const arabicQty = toSafeFinancialQuantity(rawArabic);
      const objQty = toSafeFinancialQuantity(decimalObj);

      // Assert
      expect(intQty).toBe(10);
      expect(floatQty).toBe(2.5);
      expect(arabicQty).toBe(15);
      expect(objQty).toBe(7);
    });

    it('9. rejects 0, negative, NaN, and Infinity', () => {
      // Arrange
      const invalidNumericVals = [0, '0', '٠', -5, '-10', NaN, Infinity, -Infinity];

      // Act & Assert
      // Assert
      for (const val of invalidNumericVals) {
        expect(() => toSafeFinancialQuantity(val)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      }
    });

    it('10. rejects non-numeric strings, empty inputs, and invalid objects', () => {
      // Arrange
      const invalidObjects = [
        'xyz', '', '   ', null, undefined,
        { toNumber: () => 0 },
        { toNumber: () => -5 },
        { toNumber: () => NaN },
        { toNumber: () => Infinity },
      ];

      // Act & Assert
      // Assert
      for (const obj of invalidObjects) {
        expect(() => toSafeFinancialQuantity(obj)).toThrow(/BOUNDARY_DESERIALIZATION_VIOLATION/);
      }
    });
  });

  describe('validateAmount with branded types', () => {
    it('11. returns branded PositiveFiniteAmount on valid input', () => {
      // Arrange
      const rawNum = 1500;
      const rawArabic = '٢٥٠٠';

      // Act
      const res = validateAmount(rawNum);
      const resArabic = validateAmount(rawArabic);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.amount).toBe(1500);
      const validatedBranded: PositiveFiniteAmount = res.amount!;
      expect(validatedBranded).toBe(1500);

      expect(resArabic.isValid).toBe(true);
      expect(resArabic.amount).toBe(2500);
    });

    it('12. rejects 0, negative, NaN, Infinity, -Infinity, and non-numeric strings', () => {
      // Arrange
      const inputs = [0, -50, NaN, Infinity, -Infinity, 'Infinity', 'not-a-number'];

      // Act & Assert
      // Assert
      for (const val of inputs) {
        const res = validateAmount(val);
        expect(res.isValid).toBe(false);
      }
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

    it('13. allows valid PositiveFiniteAmount and calculates correct projected balance', () => {
      // Arrange
      const validAmount = toPositiveFiniteAmount(2500);

      // Act
      const validRes = UniversalCustodyGate.verifyCustodyFunds({
        custody: mockCustody,
        requiredAmount: validAmount,
        operationType: 'شراء مهمات',
      });
      const aliasRes = verifyCustodyBalance({
        custody: mockCustody,
        requiredAmount: validAmount,
        operationType: 'شراء مهمات',
      });

      // Assert
      expect(validRes.isAllowed).toBe(true);
      expect(validRes.projectedBalance).toBe(7500);
      expect(aliasRes.isAllowed).toBe(true);
      expect(aliasRes.projectedBalance).toBe(7500);
    });

    it('14. rejects NaN or Infinity in requiredAmount across UniversalCustodyGate and verifyCustodyBalance', () => {
      // Arrange
      const invalidAmounts = [NaN, Infinity, -Infinity, 0, -500];

      // Act & Assert
      // Assert
      for (const amount of invalidAmounts) {
        const gateRes = UniversalCustodyGate.verifyCustodyFunds({
          custody: mockCustody,
          requiredAmount: amount,
          operationType: 'اختبار',
        });
        expect(gateRes.isAllowed).toBe(false);
        expect(gateRes.error).toBe('INVALID_AMOUNT');

        const aliasRes = verifyCustodyBalance({
          custody: mockCustody,
          requiredAmount: amount,
          operationType: 'اختبار',
        });
        expect(aliasRes.isAllowed).toBe(false);
        expect(aliasRes.error).toBe('INVALID_AMOUNT');
      }
    });

    it('15. rejects non-finite custody currentBalance', () => {
      // Arrange
      const nonFiniteBalances = [NaN, Infinity, -Infinity];

      // Act & Assert
      // Assert
      for (const bal of nonFiniteBalances) {
        const custodyWithBal: CustodyAccount = {
          ...mockCustody,
          currentBalance: bal,
        };
        const res = UniversalCustodyGate.verifyCustodyFunds({
          custody: custodyWithBal,
          requiredAmount: toPositiveFiniteAmount(500),
          operationType: 'اختبار',
        });
        expect(res.isAllowed).toBe(false);
        expect(res.error).toBe('INVALID_CUSTODY_BALANCE');
      }
    });
  });

  describe('TripleBalanceClearingEngine NaN/Infinity protection', () => {
    it('16. rejects NaN/Infinity/negative in cigarette clearing', () => {
      // Arrange
      const validParams = {
        workerId: 'w-1',
        workerCode: 'OP-01',
        workerName: 'علي',
        brandName: 'كليوباترا',
        packPrice: toPositiveFiniteAmount(50),
        packsCount: 2,
        siteCode: 'STE-01',
        canteenStockAvailable: 10,
      };

      // Act
      const validRes = TripleBalanceClearingEngine.processCigaretteClearing(validParams);

      // Assert
      expect(validRes.success).toBe(true);
      expect(validRes.totalAmount).toBe(100);

      // Act & Assert invalid cases
      const invalidCases = [
        { ...validParams, packPrice: NaN },
        { ...validParams, packPrice: Infinity },
        { ...validParams, packPrice: -50 },
        { ...validParams, packsCount: Infinity },
        { ...validParams, packsCount: NaN },
        { ...validParams, packsCount: 0 },
      ];

      for (const invalidCase of invalidCases) {
        const res = TripleBalanceClearingEngine.processCigaretteClearing(invalidCase);
        expect(res.success).toBe(false);
        expect(res.error).toBe('INVALID_PACK_COUNT_OR_PRICE');
      }
    });

    it('17. rejects NaN/Infinity/negative in supplier purchase clearing', () => {
      // Arrange
      const validParams = {
        workerId: 'w-1',
        workerCode: 'OP-01',
        supplierId: 'sup-1',
        supplierName: 'مورد معتمد',
        itemDescription: 'مستلزمات',
        purchaseAmount: toPositiveFiniteAmount(300),
        siteCode: 'STE-01',
        vendorPayableAvailable: 2000,
      };

      // Act
      const validRes = TripleBalanceClearingEngine.processSupplierPurchaseClearing(validParams);

      // Assert
      expect(validRes.success).toBe(true);
      expect(validRes.totalAmount).toBe(300);

      // Act & Assert invalid amounts
      const invalidAmounts = [NaN, Infinity, -Infinity, 0, -250];
      for (const purchaseAmount of invalidAmounts) {
        const res = TripleBalanceClearingEngine.processSupplierPurchaseClearing({
          ...validParams,
          purchaseAmount,
        });
        expect(res.success).toBe(false);
        expect(res.error).toBe('INVALID_PURCHASE_AMOUNT');
      }
    });

    it('18. rejects NaN/Infinity/negative in cash advance clearing', () => {
      // Arrange
      const validParams = {
        workerId: 'w-1',
        workerCode: 'OP-01',
        requestedAmount: toPositiveFiniteAmount(500),
        sourceOfFunds: 'SITE_CUSTODY' as const,
        sourceEntityId: 'cust-1',
        sourceEntityName: 'عهدة الموقع',
        availableBalance: 2000,
      };

      // Act
      const validRes = TripleBalanceClearingEngine.processCashAdvanceClearing(validParams);

      // Assert
      expect(validRes.success).toBe(true);
      expect(validRes.approvedAmount).toBe(500);

      // Act & Assert invalid requests
      const invalidRequests = [NaN, Infinity, -Infinity, 0, -300];
      for (const requestedAmount of invalidRequests) {
        const res = TripleBalanceClearingEngine.processCashAdvanceClearing({
          ...validParams,
          requestedAmount,
        });
        expect(res.success).toBe(false);
        expect(res.approvedAmount).toBe(0);
      }

      // Act & Assert non-finite balances
      const resInfBal = TripleBalanceClearingEngine.processCashAdvanceClearing({
        ...validParams,
        availableBalance: Infinity,
      });
      expect(resInfBal.success).toBe(false);

      const resNanBal = TripleBalanceClearingEngine.processCashAdvanceClearing({
        ...validParams,
        availableBalance: NaN,
      });
      expect(resNanBal.success).toBe(false);
    });
  });

  describe('UniversalInstallmentEngine NaN/Infinity protection', () => {
    it('19. calculates plan with valid PositiveFiniteAmount', () => {
      // Arrange
      const planInput = {
        workerId: 'w-1',
        totalAmount: toPositiveFiniteAmount(1200),
        installmentsCount: 3,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      };

      // Act
      const validRes = UniversalInstallmentEngine.calculatePlan(planInput);

      // Assert
      expect(validRes.isValid).toBe(true);
      expect(validRes.installments.length).toBe(3);
    });

    it('20. rejects NaN, Infinity, and non-positive totalAmount', () => {
      // Arrange
      const baseInput = {
        workerId: 'w-1',
        installmentsCount: 3,
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      };

      // Act
      const resNan = UniversalInstallmentEngine.calculatePlan({ ...baseInput, totalAmount: NaN });
      const resInf = UniversalInstallmentEngine.calculatePlan({ ...baseInput, totalAmount: Infinity });
      const resNegInf = UniversalInstallmentEngine.calculatePlan({ ...baseInput, totalAmount: -Infinity });
      const resZero = UniversalInstallmentEngine.calculatePlan({ ...baseInput, totalAmount: 0 });
      const resNeg = UniversalInstallmentEngine.calculatePlan({ ...baseInput, totalAmount: -500 });

      // Assert
      expect(resNan.isValid).toBe(false);
      expect(resNan.errorArabic).toContain('أرقاماً موجبة');
      expect(resInf.isValid).toBe(false);
      expect(resNegInf.isValid).toBe(false);
      expect(resZero.isValid).toBe(false);
      expect(resNeg.isValid).toBe(false);
    });

    it('21. rejects NaN, Infinity, zero, negative, and fractional installmentsCount', () => {
      // Arrange
      const baseInput = {
        workerId: 'w-1',
        totalAmount: toPositiveFiniteAmount(1000),
        startCycleDate: new Date('2026-10-01T00:00:00.000Z'),
        monthlySalary: 5000,
      };

      // Act
      const resNanCount = UniversalInstallmentEngine.calculatePlan({ ...baseInput, installmentsCount: NaN });
      const resInfCount = UniversalInstallmentEngine.calculatePlan({ ...baseInput, installmentsCount: Infinity });
      const resZeroCount = UniversalInstallmentEngine.calculatePlan({ ...baseInput, installmentsCount: 0 });
      const resNegCount = UniversalInstallmentEngine.calculatePlan({ ...baseInput, installmentsCount: -2 });
      const resFloatCount = UniversalInstallmentEngine.calculatePlan({ ...baseInput, installmentsCount: 2.5 });

      // Assert
      expect(resNanCount.isValid).toBe(false);
      expect(resInfCount.isValid).toBe(false);
      expect(resZeroCount.isValid).toBe(false);
      expect(resNegCount.isValid).toBe(false);
      expect(resFloatCount.isValid).toBe(false);
    });
  });

  describe('UniversalShiftAccrualEngine bounds presenceDays', () => {
    it('22. bounds NaN and negative presenceDays to 0', () => {
      // Arrange
      const config = STANDARD_SHIFT_PRESETS.STANDARD_20_10;

      // Act
      const resNan = UniversalShiftAccrualEngine.calculateAccrual({
        workerId: 'w-1',
        presenceDays: NaN,
        cycleConfig: config,
      });
      const resNeg = UniversalShiftAccrualEngine.calculateAccrual({
        workerId: 'w-1',
        presenceDays: -15,
        cycleConfig: config,
      });

      // Assert
      expect(resNan.presenceDays).toBe(0);
      expect(resNan.earnedRestDaysExact).toBe(0);
      expect(resNeg.presenceDays).toBe(0);
      expect(resNeg.earnedRestDaysExact).toBe(0);
    });

    it('23. clamps presenceDays exceeding 366', () => {
      // Arrange
      const config = STANDARD_SHIFT_PRESETS.STANDARD_20_10;

      // Act
      const resOver = UniversalShiftAccrualEngine.calculateAccrual({
        workerId: 'w-1',
        presenceDays: 500,
        cycleConfig: config,
      });
      const resNormal = UniversalShiftAccrualEngine.calculateAccrual({
        workerId: 'w-1',
        presenceDays: 20,
        cycleConfig: config,
      });

      // Assert
      expect(resOver.presenceDays).toBe(366);
      expect(resOver.earnedRestDaysExact).toBe(183);
      expect(resNormal.presenceDays).toBe(20);
      expect(resNormal.earnedRestDaysExact).toBe(10);
    });
  });
});