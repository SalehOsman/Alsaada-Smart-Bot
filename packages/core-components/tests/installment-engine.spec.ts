import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UniversalInstallmentEngine, addMonthsSafe } from '../src/installment-engine/engine.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Universal Installment Engine — Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  it('1. splits total amount evenly with remainder cents added to first installment', () => {
    // Arrange
    // 1000 EGP divided into 3 installments: 333.34, 333.33, 333.33
    const input = {
      workerId: 'w-1',
      totalAmount: 1000,
      installmentsCount: 3,
      startCycleDate: new Date('2026-10-01T00:00:00Z'),
    };

    // Act
    const res = UniversalInstallmentEngine.calculatePlan(input);

    // Assert
    expect(res.isValid).toBe(true);
    expect(res.installments.length).toBe(3);
    expect(res.installments[0]?.amount).toBe(333.34);
    expect(res.installments[1]?.amount).toBe(333.33);
    expect(res.installments[2]?.amount).toBe(333.33);

    const sum = res.installments.reduce((acc, curr) => acc + curr.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(1000);
    expect(res.installments[0]?.amount).not.toBe(res.installments[1]?.amount);
  });

  it('2. alerts when installment exceeds safe percentage of monthly salary', () => {
    // Arrange
    // Salary 6000 EGP, installment 3000 EGP (50% > max 40%)
    const input = {
      workerId: 'w-2',
      totalAmount: 6000,
      installmentsCount: 2,
      startCycleDate: new Date('2026-10-01T00:00:00Z'),
      monthlySalary: 6000,
      maxDeductionPercent: 40,
    };

    // Act
    const res = UniversalInstallmentEngine.calculatePlan(input);

    // Assert
    expect(res.isValid).toBe(true);
    expect(res.exceedsSafeLimit).toBe(true);
    expect(res.actualDeductionPercent).toBe(50);
    expect(res.warningArabic).toContain('يتجاوز السقف المؤسسي المسموح');
    expect(res.actualDeductionPercent).not.toBeLessThanOrEqual(40);
  });

  it('3. passes safely when installment is within allowed percentage', () => {
    // Arrange
    // Salary 8000 EGP, installment 1000 EGP (12.5% <= 40%)
    const input = {
      workerId: 'w-3',
      totalAmount: 4000,
      installmentsCount: 4,
      startCycleDate: new Date('2026-10-01T00:00:00Z'),
      monthlySalary: 8000,
    };

    // Act
    const res = UniversalInstallmentEngine.calculatePlan(input);

    // Assert
    expect(res.isValid).toBe(true);
    expect(res.exceedsSafeLimit).toBe(false);
    expect(res.actualDeductionPercent).toBe(12.5);
    expect(res.actualDeductionPercent).not.toBeGreaterThan(40);
  });

  describe('addMonthsSafe & End-of-Month Calendar Overflow Protection', () => {
    it('4. prevents calendar overflow on Jan 31 -> Feb 28 (non-leap year) and clamps safely', () => {
      // Arrange
      const input = {
        workerId: 'w-4',
        totalAmount: 4000,
        installmentsCount: 4,
        startCycleDate: new Date('2026-01-31T00:00:00Z'),
      };

      // Act
      const res = UniversalInstallmentEngine.calculatePlan(input);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.installments.length).toBe(4);
      expect(res.installments[0]?.dueDate).toBe('2026-01-31');
      expect(res.installments[1]?.dueDate).toBe('2026-02-28'); // Clamped to last day of Feb (non-leap)
      expect(res.installments[2]?.dueDate).toBe('2026-03-31'); // Restored anchor day 31
      expect(res.installments[3]?.dueDate).toBe('2026-04-30'); // Clamped to 30 for April
      expect(res.installments[1]?.dueDate).not.toBe('2026-03-03');
    });

    it('5. correctly handles leap year February (29 days in 2024)', () => {
      // Arrange
      const input = {
        workerId: 'w-5',
        totalAmount: 2000,
        installmentsCount: 2,
        startCycleDate: new Date('2024-01-31T00:00:00Z'),
      };

      // Act
      const res = UniversalInstallmentEngine.calculatePlan(input);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.installments[0]?.dueDate).toBe('2024-01-31');
      expect(res.installments[1]?.dueDate).toBe('2024-02-29'); // 2024 is a leap year
      expect(res.installments[1]?.dueDate).not.toBe('2024-02-28');
    });

    it('6. handles mid-month dates without clamping', () => {
      // Arrange
      const input = {
        workerId: 'w-6',
        totalAmount: 3000,
        installmentsCount: 3,
        startCycleDate: new Date('2026-01-15T00:00:00Z'),
      };

      // Act
      const res = UniversalInstallmentEngine.calculatePlan(input);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.installments[0]?.dueDate).toBe('2026-01-15');
      expect(res.installments[1]?.dueDate).toBe('2026-02-15');
      expect(res.installments[2]?.dueDate).toBe('2026-03-15');
      expect(res.installments[1]?.dueDate).not.toBe('2026-02-14');
    });

    it('7. throws error when an invalid date is passed to addMonthsSafe', () => {
      // Arrange
      const invalidDate = new Date('invalid-date');

      // Act
      const action = () => addMonthsSafe(invalidDate, 1);

      // Assert
      expect(action).toThrow(
        /Invalid baseDate provided to addMonthsSafe/
      );
    });

    it('8. handles backward offsets safely (e.g. March 31 minus 1 month -> Feb 28)', () => {
      // Arrange
      const march31 = new Date('2026-03-31T00:00:00Z');

      // Act
      const febResult = addMonthsSafe(march31, -1);

      // Assert
      expect(febResult.toISOString().substring(0, 10)).toBe('2026-02-28');
      expect(febResult.toISOString().substring(0, 10)).not.toBe('2026-03-03');
    });
  });
});
