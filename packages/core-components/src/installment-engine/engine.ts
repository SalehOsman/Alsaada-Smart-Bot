import type { InstallmentPlanParams, InstallmentPlanResult, SingleInstallment } from './types.js';

/**
 * 📅 Safe month addition algorithm that prevents month-end overflow bugs in JavaScript Date.
 * When baseDate is on day 29, 30, or 31 and the target month has fewer days,
 * clamps the day to the last valid day of the target month (e.g. 31 Jan -> 28/29 Feb).
 * Preserves the original anchor day across subsequent cycles when allowed.
 */
export function addMonthsSafe(baseDate: Date, monthsToAdd: number): Date {
  if (!baseDate || isNaN(baseDate.getTime())) {
    throw new Error('[INSTALLMENT_CALENDAR_ERROR] Invalid baseDate provided to addMonthsSafe.');
  }
  const result = new Date(baseDate.getTime());
  const originalDay = baseDate.getUTCDate();

  // Anchor to day 1 first to prevent intermediate overflow
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + monthsToAdd);

  // Compute last day of target month
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();

  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
}

export class UniversalInstallmentEngine {
  /**
   * 📊 حساب خطة الأقساط الشهرية الآمنة مع قفل كسور القروش في القسط الأول
   * وفحص عدم تجاوز سقف الخصم الآمن من الراتب (Safety Deductible Ceiling)
   */
  static calculatePlan(params: InstallmentPlanParams): InstallmentPlanResult {
    const { totalAmount, installmentsCount, startCycleDate, monthlySalary, maxDeductionPercent = 40 } = params;

    if (totalAmount <= 0 || installmentsCount <= 0 || !Number.isInteger(installmentsCount)) {
      return {
        isValid: false,
        totalAmount,
        installmentsCount,
        monthlyDeductionAmount: 0,
        exceedsSafeLimit: false,
        installments: [],
        errorArabic: '⚠️ إجمالي المبلغ وعدد الأقساط يجب أن تكون أرقاماً موجبة صحيحة.',
      };
    }

    // حساب القسط الأساسي
    const baseAmount = Math.floor((totalAmount / installmentsCount) * 100) / 100;
    const remainder = Math.round((totalAmount - baseAmount * installmentsCount) * 100) / 100;

    const installments: SingleInstallment[] = [];

    for (let i = 1; i <= installmentsCount; i++) {
      // يضاف باقي الكسور للقسط الأول لضمان التوازن المالي التام
      const installmentAmount = i === 1 ? Math.round((baseAmount + remainder) * 100) / 100 : baseAmount;

      const dueDate = addMonthsSafe(startCycleDate, i - 1);
      const dueDateStr = dueDate.toISOString().substring(0, 10);
      installments.push({
        installmentNumber: i,
        dueDate: dueDateStr,
        amount: installmentAmount,
        status: 'SCHEDULED',
      });
    }

    const firstMonthDeduction = installments[0]?.amount || 0;
    let actualDeductionPercent: number | undefined;
    let exceedsSafeLimit = false;
    let warningArabic: string | undefined;

    if (monthlySalary && monthlySalary > 0) {
      actualDeductionPercent = Math.round((firstMonthDeduction / monthlySalary) * 10000) / 100;
      if (actualDeductionPercent > maxDeductionPercent) {
        exceedsSafeLimit = true;
        warningArabic = `⚠️ تنبيه مالي: قسط الشهر الأول (${firstMonthDeduction} ج.م) يمثل (${actualDeductionPercent}%) من راتب العامل (${monthlySalary} ج.م)، وهو يتجاوز السقف المؤسسي المسموح (${maxDeductionPercent}%). يُنصح بزيادة عدد الأقساط.`;
      }
    }

    return {
      isValid: true,
      totalAmount,
      installmentsCount,
      monthlySalary,
      monthlyDeductionAmount: firstMonthDeduction,
      actualDeductionPercent,
      exceedsSafeLimit,
      installments,
      warningArabic,
    };
  }
}
