import { describe, it, expect } from 'vitest';
import { UniversalInstallmentEngine, addMonthsSafe } from '../src/installment-engine/engine.js';

describe('Universal Installment Engine — Tests', () => {
  it('should split total amount evenly with remainder cents added to first installment', () => {
    // 1000 EGP divided into 3 installments: 333.34, 333.33, 333.33
    const res = UniversalInstallmentEngine.calculatePlan({
      workerId: 'w-1',
      totalAmount: 1000,
      installmentsCount: 3,
      startCycleDate: new Date('2026-10-01T00:00:00Z'),
    });

    expect(res.isValid).toBe(true);
    expect(res.installments.length).toBe(3);
    expect(res.installments[0]?.amount).toBe(333.34);
    expect(res.installments[1]?.amount).toBe(333.33);
    expect(res.installments[2]?.amount).toBe(333.33);

    const sum = res.installments.reduce((acc, curr) => acc + curr.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(1000);
  });

  it('should alert if installment exceeds safe percentage of monthly salary', () => {
    // Salary 6000 EGP, installment 3000 EGP (50% > max 40%)
    const res = UniversalInstallmentEngine.calculatePlan({
      workerId: 'w-2',
      totalAmount: 6000,
      installmentsCount: 2,
      startCycleDate: new Date('2026-10-01T00:00:00Z'),
      monthlySalary: 6000,
      maxDeductionPercent: 40,
    });

    expect(res.isValid).toBe(true);
    expect(res.exceedsSafeLimit).toBe(true);
    expect(res.actualDeductionPercent).toBe(50);
    expect(res.warningArabic).toContain('يتجاوز السقف المؤسسي المسموح');
  });

  it('should pass safely when installment is within allowed percentage', () => {
    // Salary 8000 EGP, installment 1000 EGP (12.5% <= 40%)
    const res = UniversalInstallmentEngine.calculatePlan({
      workerId: 'w-3',
      totalAmount: 4000,
      installmentsCount: 4,
      startCycleDate: new Date('2026-10-01T00:00:00Z'),
      monthlySalary: 8000,
    });

    expect(res.isValid).toBe(true);
    expect(res.exceedsSafeLimit).toBe(false);
    expect(res.actualDeductionPercent).toBe(12.5);
  });

  describe('addMonthsSafe & End-of-Month Calendar Overflow Protection', () => {
    it('prevents calendar overflow on Jan 31 -> Feb 28 (non-leap year) and clamps safely', () => {
      const res = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-4',
        totalAmount: 4000,
        installmentsCount: 4,
        startCycleDate: new Date('2026-01-31T00:00:00Z'),
      });

      expect(res.isValid).toBe(true);
      expect(res.installments.length).toBe(4);
      expect(res.installments[0]?.dueDate).toBe('2026-01-31');
      expect(res.installments[1]?.dueDate).toBe('2026-02-28'); // Clamped to last day of Feb (non-leap)
      expect(res.installments[2]?.dueDate).toBe('2026-03-31'); // Restored anchor day 31
      expect(res.installments[3]?.dueDate).toBe('2026-04-30'); // Clamped to 30 for April
    });

    it('correctly handles leap year February (29 days in 2024)', () => {
      const res = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-5',
        totalAmount: 2000,
        installmentsCount: 2,
        startCycleDate: new Date('2024-01-31T00:00:00Z'),
      });

      expect(res.isValid).toBe(true);
      expect(res.installments[0]?.dueDate).toBe('2024-01-31');
      expect(res.installments[1]?.dueDate).toBe('2024-02-29'); // 2024 is a leap year
    });

    it('handles mid-month dates without clamping', () => {
      const res = UniversalInstallmentEngine.calculatePlan({
        workerId: 'w-6',
        totalAmount: 3000,
        installmentsCount: 3,
        startCycleDate: new Date('2026-01-15T00:00:00Z'),
      });

      expect(res.isValid).toBe(true);
      expect(res.installments[0]?.dueDate).toBe('2026-01-15');
      expect(res.installments[1]?.dueDate).toBe('2026-02-15');
      expect(res.installments[2]?.dueDate).toBe('2026-03-15');
    });

    it('throws error when an invalid date is passed to addMonthsSafe', () => {
      expect(() => addMonthsSafe(new Date('invalid-date'), 1)).toThrow(
        /Invalid baseDate provided to addMonthsSafe/
      );
    });

    it('handles backward offsets safely (e.g. March 31 minus 1 month -> Feb 28)', () => {
      const march31 = new Date('2026-03-31T00:00:00Z');
      const febResult = addMonthsSafe(march31, -1);
      expect(febResult.toISOString().substring(0, 10)).toBe('2026-02-28');
    });
  });
});
