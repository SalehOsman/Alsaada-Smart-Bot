import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UniversalShiftAccrualEngine, STANDARD_SHIFT_PRESETS } from '../src/shift-accrual/engine.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Universal Shift Accrual Engine — Tests', () => {
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

  it('1. calculates exact earned rest days for standard 20+10 shift (ratio 0.5)', () => {
    // Arrange
    const input = {
      workerId: 'w-1',
      presenceDays: 20,
      cycleConfig: STANDARD_SHIFT_PRESETS.STANDARD_20_10,
    };

    // Act
    const res = UniversalShiftAccrualEngine.calculateAccrual(input);

    // Assert
    expect(res.cycleRatio).toBe(0.5);
    expect(res.earnedRestDaysExact).toBe(10);
    expect(res.earnedRestDaysRounded).toBe(10);
    expect(res.fractionalDayRemainder).toBe(0);
  });

  it('2. calculates prorated rest days when worker leaves mid-cycle', () => {
    // Arrange
    // 12 days presence in 20+10 cycle -> 12 * 0.5 = 6 days
    const input = {
      workerId: 'w-2',
      presenceDays: 12,
      cycleConfig: STANDARD_SHIFT_PRESETS.STANDARD_20_10,
    };

    // Act
    const res = UniversalShiftAccrualEngine.calculateAccrual(input);

    // Assert
    expect(res.earnedRestDaysExact).toBe(6);
    expect(res.earnedRestDaysRounded).toBe(6);
    expect(res.fractionalDayRemainder).toBe(0);
  });

  it('3. handles non-integer fractional day remainder accurately in 24+6 shift', () => {
    // Arrange
    // 24 work, 6 rest -> ratio = 6/24 = 0.25
    // 15 days presence -> 15 * 0.25 = 3.75 days (3 full days + 0.75 fraction)
    const input = {
      workerId: 'w-3',
      presenceDays: 15,
      cycleConfig: STANDARD_SHIFT_PRESETS.EXTENDED_24_6,
    };

    // Act
    const res = UniversalShiftAccrualEngine.calculateAccrual(input);

    // Assert
    expect(res.cycleRatio).toBe(0.25);
    expect(res.earnedRestDaysExact).toBe(3.75);
    expect(res.earnedRestDaysRounded).toBe(3);
    expect(res.fractionalDayRemainder).toBe(0.75);
    expect(res.summaryArabic).toContain('3.75 يوم راحة مستحقة');
  });

  it('4. clamps negative and out-of-range presence days safely', () => {
    // Arrange
    const negParams = {
      workerId: 'w-neg',
      presenceDays: -5,
      cycleConfig: STANDARD_SHIFT_PRESETS.STANDARD_20_10,
    };
    const excessParams = {
      workerId: 'w-excess',
      presenceDays: 500,
      cycleConfig: STANDARD_SHIFT_PRESETS.STANDARD_20_10,
    };

    // Act
    const resNeg = UniversalShiftAccrualEngine.calculateAccrual(negParams);
    const resExcess = UniversalShiftAccrualEngine.calculateAccrual(excessParams);

    // Assert
    expect(resNeg.presenceDays).toBe(0);
    expect(resNeg.presenceDays).not.toBeLessThan(0);
    expect(resNeg.earnedRestDaysExact).toBe(0);
    expect(resExcess.presenceDays).toBe(366);
    expect(resExcess.presenceDays).not.toBeGreaterThan(366);
    expect(resExcess.earnedRestDaysExact).toBe(183);
  });
});
