import { describe, it, expect } from 'vitest';
import { UniversalShiftAccrualEngine, STANDARD_SHIFT_PRESETS } from '../src/shift-accrual/engine.js';

describe('Universal Shift Accrual Engine — Tests', () => {
  it('should calculate exact earned rest days for standard 20+10 shift (ratio 0.5)', () => {
    const res = UniversalShiftAccrualEngine.calculateAccrual({
      workerId: 'w-1',
      presenceDays: 20,
      cycleConfig: STANDARD_SHIFT_PRESETS.STANDARD_20_10,
    });

    expect(res.cycleRatio).toBe(0.5);
    expect(res.earnedRestDaysExact).toBe(10);
    expect(res.earnedRestDaysRounded).toBe(10);
    expect(res.fractionalDayRemainder).toBe(0);
  });

  it('should calculate prorated rest days when worker leaves mid-cycle', () => {
    // 12 days presence in 20+10 cycle -> 12 * 0.5 = 6 days
    const res = UniversalShiftAccrualEngine.calculateAccrual({
      workerId: 'w-2',
      presenceDays: 12,
      cycleConfig: STANDARD_SHIFT_PRESETS.STANDARD_20_10,
    });

    expect(res.earnedRestDaysExact).toBe(6);
  });

  it('should handle non-integer fractional day remainder accurately in 24+6 shift', () => {
    // 24 work, 6 rest -> ratio = 6/24 = 0.25
    // 15 days presence -> 15 * 0.25 = 3.75 days (3 full days + 0.75 fraction)
    const res = UniversalShiftAccrualEngine.calculateAccrual({
      workerId: 'w-3',
      presenceDays: 15,
      cycleConfig: STANDARD_SHIFT_PRESETS.EXTENDED_24_6,
    });

    expect(res.cycleRatio).toBe(0.25);
    expect(res.earnedRestDaysExact).toBe(3.75);
    expect(res.earnedRestDaysRounded).toBe(3);
    expect(res.fractionalDayRemainder).toBe(0.75);
    expect(res.summaryArabic).toContain('3.75 يوم راحة مستحقة');
  });
});
