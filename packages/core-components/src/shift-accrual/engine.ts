import type { AccrualCalculationParams, LeaveAccrualResult, ShiftCycleConfig, ShiftCycleType } from './types.js';

export const STANDARD_SHIFT_PRESETS: Record<ShiftCycleType, ShiftCycleConfig> = {
  STANDARD_20_10: { type: 'STANDARD_20_10', workDays: 20, restDays: 10, labelArabic: 'دورة قياسية (20+10)' },
  EXTENDED_24_6: { type: 'EXTENDED_24_6', workDays: 24, restDays: 6, labelArabic: 'دورة ممتدة (24+6)' },
  INTENSE_26_4: { type: 'INTENSE_26_4', workDays: 26, restDays: 4, labelArabic: 'دورة مكثفة (26+4)' },
  WEEKLY_6_1: { type: 'WEEKLY_6_1', workDays: 6, restDays: 1, labelArabic: 'دورة أسبوعية (6+1)' },
  CUSTOM: { type: 'CUSTOM', workDays: 20, restDays: 10, labelArabic: 'دورة مخصصة' },
};

export class UniversalShiftAccrualEngine {
  /**
   * ⏱️ حساب رصيد أيام الراحة المكتسبة تناسبياً وفق أيام التواجد الفعلي وطبيعة الدورة
   */
  static calculateAccrual(params: AccrualCalculationParams): LeaveAccrualResult {
    const { presenceDays, cycleConfig } = params;

    const workDays = cycleConfig.workDays > 0 ? cycleConfig.workDays : 20;
    const restDays = cycleConfig.restDays >= 0 ? cycleConfig.restDays : 10;
    const ratio = restDays / workDays;

    const exactEarned = Math.round(presenceDays * ratio * 100) / 100;
    const roundedEarned = Math.floor(exactEarned);
    const fractionRemainder = Math.round((exactEarned - roundedEarned) * 100) / 100;

    const summary = `${presenceDays} يوم تواجد × (${restDays} راحة / ${workDays} عمل) = ${exactEarned} يوم راحة مستحقة (${roundedEarned} يوم كامل + ${fractionRemainder} كسر يوم)`;

    return {
      presenceDays,
      workDaysInCycle: workDays,
      restDaysInCycle: restDays,
      cycleRatio: ratio,
      earnedRestDaysExact: exactEarned,
      earnedRestDaysRounded: roundedEarned,
      fractionalDayRemainder: fractionRemainder,
      summaryArabic: summary,
    };
  }
}
