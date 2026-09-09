import { prisma } from '../db.js';
import { systemDataService } from './system-data.service.js';

export type TransitionPolicy =
  | 'IMMEDIATE_PRORATED'
  | 'NEXT_CYCLE'
  | 'NEW_HIRES_ONLY'
  | 'CUSTOM_DATE';

export interface RecordJobCycleTransitionParams {
  jobId: string;
  deptCode: string;
  jobCode: string;
  jobTitleName: string;
  previousWorkDays: number;
  previousRestDays: number;
  newWorkDays: number;
  newRestDays: number;
  policy: TransitionPolicy;
  effectiveDate?: Date;
  appliedByAdminId?: bigint;
  notes?: string;
}

export interface ProrationPeriodBreakdown {
  periodLabel: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  workDays: number;
  restDays: number;
  ratio: number;
  earnedRestDays: number;
}

export interface ProratedAccrualResult {
  totalPresenceDays: number;
  totalEarnedRestDays: number;
  integerLeaveDays: number;
  fractionalDay: number;
  periods: ProrationPeriodBreakdown[];
  summaryArabic: string;
}

export class CycleTransitionService {
  /**
   * 📝 تسجيل حركة تعديل الدورة في السجل التاريخي وتطبيقها وفق السياسة المختارة
   */
  async recordJobCycleTransition(params: RecordJobCycleTransitionParams) {
    const prevRatio = params.previousRestDays / (params.previousWorkDays || 20);
    const newRatio = params.newRestDays / (params.newWorkDays || 20);
    const totalCycleDays = params.newWorkDays + params.newRestDays;

    let shiftNature = `دورة مخصصة (${params.newWorkDays}+${params.newRestDays})`;
    if (params.newWorkDays === 20 && params.newRestDays === 10) shiftNature = 'دورة قياسية (20+10)';
    else if (params.newWorkDays === 24 && params.newRestDays === 6) shiftNature = 'دورة ممتدة (24+6)';
    else if (params.newWorkDays === 26 && params.newRestDays === 4) shiftNature = 'دورة مكثفة (26+4)';
    else if (params.newWorkDays === 6 && params.newRestDays === 1) shiftNature = 'دورة أسبوعية (6+1)';

    const effectiveDate = params.effectiveDate || new Date();

    // 1. تسجيل الحركة في جدول التاريخ المالي المحصن
    const historyRecord = await prisma.cycleTransitionHistory.create({
      data: {
        targetType: 'JOB_TITLE',
        targetId: params.jobId,
        targetCode: params.jobCode,
        targetName: params.jobTitleName,
        previousWorkDays: params.previousWorkDays,
        previousRestDays: params.previousRestDays,
        previousRatio: prevRatio,
        newWorkDays: params.newWorkDays,
        newRestDays: params.newRestDays,
        newRatio: newRatio,
        transitionPolicy: params.policy,
        effectiveDate,
        appliedByAdminId: params.appliedByAdminId ?? null,
        notes: params.notes ?? null,
      },
    });

    // 2. تحديث بطاقة الوظيفة
    await prisma.jobTitle.update({
      where: { id: params.jobId },
      data: {
        workDays: params.newWorkDays,
        restDays: params.newRestDays,
        totalCycleDays,
        shiftNature,
      },
    });

    // 3. تطهير الكاش اللحظي
    await systemDataService.invalidateDepartmentsAndJobs();

    return {
      historyRecord,
      shiftNature,
      totalCycleDays,
      prevRatio,
      newRatio,
    };
  }

  /**
   * 🧮 خوارزمية التجزئة الزمنية لحساب أيام الراحة المكتسبة بدقة الكسور
   */
  calculateProratedAccrual(params: {
    periodStartDate: string; // YYYY-MM-DD
    periodEndDate: string;   // YYYY-MM-DD
    transitions: Array<{
      effectiveDate: Date | string;
      previousWorkDays: number;
      previousRestDays: number;
      newWorkDays: number;
      newRestDays: number;
    }>;
    fallbackWorkDays: number;
    fallbackRestDays: number;
  }): ProratedAccrualResult {
    const start = new Date(params.periodStartDate + 'T00:00:00Z');
    const end = new Date(params.periodEndDate + 'T00:00:00Z');

    const totalDays = Math.max(
      0,
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );

    // إذا لم توجد أي حركات انتقال في الفترة، تحسب بالفترة البسيطة
    if (!params.transitions || params.transitions.length === 0) {
      const ratio = params.fallbackRestDays / (params.fallbackWorkDays || 20);
      const earned = Math.round(totalDays * ratio * 100) / 100;
      const integerPart = Math.floor(earned);
      const fractionPart = Math.round((earned - integerPart) * 100) / 100;

      return {
        totalPresenceDays: totalDays,
        totalEarnedRestDays: earned,
        integerLeaveDays: integerPart,
        fractionalDay: fractionPart,
        periods: [
          {
            periodLabel: `فترة كاملة (${params.periodStartDate} إلى ${params.periodEndDate})`,
            startDate: params.periodStartDate,
            endDate: params.periodEndDate,
            daysCount: totalDays,
            workDays: params.fallbackWorkDays,
            restDays: params.fallbackRestDays,
            ratio,
            earnedRestDays: earned,
          },
        ],
        summaryArabic: `${totalDays} يوم عمل × (${params.fallbackWorkDays}/${params.fallbackRestDays}) = ${earned} يوم راحة`,
      };
    }

    // تصفية الحركات الواقعة داخل نافذة التاريخ
    const relevantTransitions = params.transitions
      .map((t) => ({
        ...t,
        effDate: typeof t.effectiveDate === 'string' ? new Date(t.effectiveDate + 'T00:00:00Z') : t.effectiveDate,
      }))
      .filter((t) => t.effDate > start && t.effDate <= end)
      .sort((a, b) => a.effDate.getTime() - b.effDate.getTime());

    if (relevantTransitions.length === 0) {
      const ratio = params.fallbackRestDays / (params.fallbackWorkDays || 20);
      const earned = Math.round(totalDays * ratio * 100) / 100;
      const integerPart = Math.floor(earned);
      const fractionPart = Math.round((earned - integerPart) * 100) / 100;

      return {
        totalPresenceDays: totalDays,
        totalEarnedRestDays: earned,
        integerLeaveDays: integerPart,
        fractionalDay: fractionPart,
        periods: [
          {
            periodLabel: `فترة كاملة (${params.periodStartDate} إلى ${params.periodEndDate})`,
            startDate: params.periodStartDate,
            endDate: params.periodEndDate,
            daysCount: totalDays,
            workDays: params.fallbackWorkDays,
            restDays: params.fallbackRestDays,
            ratio,
            earnedRestDays: earned,
          },
        ],
        summaryArabic: `${totalDays} يوم عمل × (${params.fallbackWorkDays}/${params.fallbackRestDays}) = ${earned} يوم راحة`,
      };
    }

    // تقسيم النطاق الزمني إلى فترات تجزئة
    const periods: ProrationPeriodBreakdown[] = [];
    let currentStart = new Date(start);
    let totalEarned = 0;

    for (let i = 0; i < relevantTransitions.length; i++) {
      const transition = relevantTransitions[i]!;
      const transDate = new Date(transition.effDate);

      // الفترة السابقة لتاريخ هذا الانتقال (تأخذ النسبة السابقة)
      const periodEnd = new Date(transDate.getTime() - 24 * 60 * 60 * 1000);
      if (periodEnd >= currentStart) {
        const pDays = Math.round((periodEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const pRatio = transition.previousRestDays / (transition.previousWorkDays || 20);
        const pEarned = Math.round(pDays * pRatio * 100) / 100;
        totalEarned += pEarned;

        const sStr = currentStart.toISOString().substring(0, 10);
        const eStr = periodEnd.toISOString().substring(0, 10);

        periods.push({
          periodLabel: `فترة 1 (${sStr} إلى ${eStr})`,
          startDate: sStr,
          endDate: eStr,
          daysCount: pDays,
          workDays: transition.previousWorkDays,
          restDays: transition.previousRestDays,
          ratio: pRatio,
          earnedRestDays: pEarned,
        });

        currentStart = new Date(transDate);
      }
    }

    // الفترة المتبقية حتى نهاية النطاق الزمني (تأخذ النسبة الأحدث)
    if (currentStart <= end) {
      const lastTrans = relevantTransitions[relevantTransitions.length - 1]!;
      const pDays = Math.round((end.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const pRatio = lastTrans.newRestDays / (lastTrans.newWorkDays || 20);
      const pEarned = Math.round(pDays * pRatio * 100) / 100;
      totalEarned += pEarned;

      const sStr = currentStart.toISOString().substring(0, 10);
      const eStr = end.toISOString().substring(0, 10);

      periods.push({
        periodLabel: `فترة ${periods.length + 1} (${sStr} إلى ${eStr})`,
        startDate: sStr,
        endDate: eStr,
        daysCount: pDays,
        workDays: lastTrans.newWorkDays,
        restDays: lastTrans.newRestDays,
        ratio: pRatio,
        earnedRestDays: pEarned,
      });
    }

    const netEarned = Math.round(totalEarned * 100) / 100;
    const integerPart = Math.floor(netEarned);
    const fractionPart = Math.round((netEarned - integerPart) * 100) / 100;

    const summaryParts = periods.map(
      (p) => `${p.daysCount} يوم @ (${p.workDays}/${p.restDays}) = ${p.earnedRestDays} يوم`
    );

    return {
      totalPresenceDays: totalDays,
      totalEarnedRestDays: netEarned,
      integerLeaveDays: integerPart,
      fractionalDay: fractionPart,
      periods,
      summaryArabic: summaryParts.join(' + ') + ` = إجمالي ${netEarned} يوم راحة`,
    };
  }

  /**
   * 📜 استرجاع السجل التاريخي لحركات انتقال الدورة لجهة محددة
   */
  async getTransitionHistory(targetType: string, targetId: string, limit = 10) {
    return prisma.cycleTransitionHistory.findMany({
      where: { targetType, targetId },
      orderBy: { effectiveDate: 'desc' },
      take: limit,
    });
  }
}

export const cycleTransitionService = new CycleTransitionService();
