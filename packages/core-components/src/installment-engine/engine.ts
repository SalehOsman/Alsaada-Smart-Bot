import type { InstallmentPlanParams, InstallmentPlanResult, SingleInstallment } from './types.js';

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
    const currentMonth = new Date(startCycleDate);

    for (let i = 1; i <= installmentsCount; i++) {
      // يضاف باقي الكسور للقسط الأول لضمان التوازن المالي التام
      const installmentAmount = i === 1 ? Math.round((baseAmount + remainder) * 100) / 100 : baseAmount;

      const dueDateStr = currentMonth.toISOString().substring(0, 10);
      installments.push({
        installmentNumber: i,
        dueDate: dueDateStr,
        amount: installmentAmount,
        status: 'SCHEDULED',
      });

      // الشهر التالي
      currentMonth.setMonth(currentMonth.getMonth() + 1);
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
