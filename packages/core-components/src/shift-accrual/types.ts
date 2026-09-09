export type ShiftCycleType = 'STANDARD_20_10' | 'EXTENDED_24_6' | 'INTENSE_26_4' | 'WEEKLY_6_1' | 'CUSTOM';

export interface ShiftCycleConfig {
  type: ShiftCycleType;
  workDays: number;
  restDays: number;
  labelArabic: string;
}

export interface AccrualCalculationParams {
  workerId: string;
  presenceDays: number;
  cycleConfig: ShiftCycleConfig;
}

export interface LeaveAccrualResult {
  presenceDays: number;
  workDaysInCycle: number;
  restDaysInCycle: number;
  cycleRatio: number;
  earnedRestDaysExact: number;
  earnedRestDaysRounded: number;
  fractionalDayRemainder: number;
  summaryArabic: string;
}
