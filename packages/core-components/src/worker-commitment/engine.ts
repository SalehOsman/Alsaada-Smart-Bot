import { createHash } from 'node:crypto';
import type {
  WorkerCommitmentInput,
  WorkerCommitmentResult,
  CommitmentTier,
  CommitmentBreakdown,
} from './types.js';

export class WorkerCommitmentEngine {
  /**
   * 🧮 محرك احتساب مؤشر التزام وموثوقية العامل الشامل
   */
  static calculateScore(input: WorkerCommitmentInput): WorkerCommitmentResult {
    const evaluationDate = input.evaluationDate || new Date();
    const isDailyLabor = input.contractType === 'DAILY_LABOR';

    // 1. انضباط الإجازات والورديات (الوزن: 40 نقطة)
    let unexcusedAbsenceDays = 0;
    let excusedDelaysCount = 0;

    if (isDailyLabor) {
      if (typeof input.unexcusedAbsenceDays === 'number') {
        unexcusedAbsenceDays = Math.max(0, input.unexcusedAbsenceDays);
      } else if (input.scheduledDays && typeof input.attendedDays === 'number') {
        unexcusedAbsenceDays = Math.max(0, input.scheduledDays - input.attendedDays);
      }
    } else if (input.leaves && input.leaves.length > 0) {
      for (const leave of input.leaves) {
        if (leave.overdueDays > 0) {
          if (leave.isOverstayPardoned || leave.overstayPardonReason) {
            excusedDelaysCount += leave.overdueDays;
          } else {
            unexcusedAbsenceDays += leave.overdueDays;
          }
        }
      }
      if (typeof input.unexcusedAbsenceDays === 'number') {
        unexcusedAbsenceDays += Math.max(0, input.unexcusedAbsenceDays);
      }
    } else if (typeof input.unexcusedAbsenceDays === 'number') {
      unexcusedAbsenceDays = Math.max(0, input.unexcusedAbsenceDays);
    }

    const leaveDeduction = unexcusedAbsenceDays * 8;
    const leaveShiftScore = Math.max(0, Math.min(40, 40 - leaveDeduction));

    // 2. السجل التأديبي النظيف والتميز (الوزن: 30 نقطة)
    let penaltiesCount = 0;
    let bonusesCount = 0;

    if (input.disciplinaryRecords && input.disciplinaryRecords.length > 0) {
      for (const disc of input.disciplinaryRecords) {
        if (disc.type.startsWith('PENALTY_')) {
          penaltiesCount++;
        } else if (disc.type.startsWith('BONUS_')) {
          bonusesCount++;
        }
      }
    }

    const disciplinaryScore = Math.max(
      0,
      Math.min(30, 30 - penaltiesCount * 10 + bonusesCount * 5)
    );

    // 3. المحافظة على مهمات الوقاية الشخصية PPE (الوزن: 15 نقطة)
    let damagedPpeCount = 0;

    if (input.ppeAssets && input.ppeAssets.length > 0) {
      for (const ppe of input.ppeAssets) {
        const isNegligentLost = ppe.condition === 'LOST_NEGLIGENT';
        const isDamagedNegligent =
          (ppe.status === 'LOST' || ppe.status === 'DAMAGED') &&
          ppe.condition !== 'DAMAGED_NATURAL';

        if (isNegligentLost || isDamagedNegligent) {
          damagedPpeCount++;
        }
      }
    }

    const ppeScore = Math.max(0, Math.min(15, 15 - damagedPpeCount * 7.5));

    // 4. الانضباط المالي وسداد السلف (الوزن: 15 نقطة)
    let financialDefaultsCount = 0;

    if (input.advanceRecords && input.advanceRecords.length > 0) {
      for (const adv of input.advanceRecords) {
        if (adv.hasOverdueInstallments) {
          financialDefaultsCount += adv.overdueInstallmentsCount || 1;
        } else if (adv.status === 'REJECTED') {
          financialDefaultsCount += 0.5;
        }
      }
    }

    const financialScore = Math.max(0, Math.min(15, 15 - financialDefaultsCount * 7.5));

    // 5. المجموع الكلي (من 100)
    const rawScore = leaveShiftScore + disciplinaryScore + ppeScore + financialScore;
    const totalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    // 6. التحقق من فترة الاختبار (Probation: أول 30 يوماً من التعيين)
    const daysSinceHire = Math.max(
      0,
      Math.floor(
        (input.periodEnd.getTime() - input.hireDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    );
    const isProbation = daysSinceHire < 30;

    let tier: CommitmentTier;
    let tierArabic: string;
    let tierBadge: string;

    if (isProbation) {
      tier = 'PROBATION';
      tierArabic = 'حديث تعيين / قيد التجربة';
      tierBadge = '⚪';
    } else if (totalScore >= 80) {
      tier = 'COMMITTED';
      tierArabic = 'ملتزم';
      tierBadge = '🟢';
    } else if (totalScore >= 60) {
      tier = 'MODERATE';
      tierArabic = 'متوسط الالتزام';
      tierBadge = '🟡';
    } else {
      tier = 'UNDER_REVIEW';
      tierArabic = 'غير ملتزم / قيد المتابعة';
      tierBadge = '🔴';
    }

    // 7. صياغة إرشادات التعافي والتحسين (Actionable Recovery Guidance)
    const guidanceList: string[] = [];

    if (leaveShiftScore < 40) {
      guidanceList.push(
        '⏱️ الالتزام التام بمواعيد العودة من الإجازات وتجنب التأخير غير المبرر لرفع نقاط انضباط الدوام (+8 نقاط لكل التزام).'
      );
    }
    if (disciplinaryScore < 30) {
      guidanceList.push(
        '⚖️ تجنب المخالفات والحرص على تعليمات السلامة والتميز للحصول على مكافآت تشغيلية (+5 نقاط لكل مكافأة).'
      );
    }
    if (ppeScore < 15) {
      guidanceList.push(
        '🦺 الحفاظ على مهمات الوقاية الشخصية المسلمة وتجنب فقدها أو إتلافها بالإهمال (+7.5 نقطة).'
      );
    }
    if (financialScore < 15) {
      guidanceList.push(
        '💰 سداد أقساط السلف بانتظام وتجنب تراكم المديونيات لرفع الجدارة الائتمانية والمالية (+7.5 نقطة).'
      );
    }
    if (guidanceList.length === 0) {
      guidanceList.push(
        '⭐ أداء متميز واستثنائي! حافظ على هذا المستوى الرائع للحصول على أولوية الترقي والمكافآت السنوية.'
      );
    }

    const recoveryGuidanceText = guidanceList.join('\n');

    // 8. الهاش الجنائي لعدم التلاعب (SHA-256 Checksum)
    const canonicalPayload = JSON.stringify({
      workerId: input.workerId,
      workerCode: input.workerCode,
      totalScore,
      leaveShiftScore,
      disciplinaryScore,
      ppeScore,
      financialScore,
      tier,
      isProbation,
      periodStart: input.periodStart.toISOString(),
      periodEnd: input.periodEnd.toISOString(),
    });
    const sha256Checksum = createHash('sha256').update(canonicalPayload).digest('hex');

    const breakdown: CommitmentBreakdown = {
      leaveShiftScore,
      disciplinaryScore,
      ppeScore,
      financialScore,
      rawScore,
      totalScore,
      tier,
      tierArabic,
      tierBadge,
      isProbation,
      unexcusedAbsenceDays,
      excusedDelaysCount,
      penaltiesCount,
      bonusesCount,
      damagedPpeCount,
      financialDefaultsCount,
      recoveryGuidance: guidanceList,
      sha256Checksum,
    };

    return {
      workerId: input.workerId,
      workerName: input.workerName,
      nickname: input.nickname ?? null,
      workerCode: input.workerCode,
      contractTypeEvaluated: input.contractType,
      siteId: input.siteId ?? null,
      siteName: input.siteName ?? null,
      jobTitle: input.jobTitle ?? null,
      evaluationDate,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      totalScore,
      tier,
      tierArabic,
      tierBadge,
      leaveShiftScore,
      disciplinaryScore,
      ppeScore,
      financialScore,
      breakdown,
      recoveryGuidance: recoveryGuidanceText,
      sha256Checksum,
    };
  }

  /**
   * 🔑 مفتاح الكاش اللحظي للتقييم
   */
  static getLiveCacheKey(workerId: string): string {
    return `wcs:live:${workerId}`;
  }

  /**
   * 🔄 فحص ما إذا كان الحدث التشغيلي يستدعي إبطال الكاش وإعادة الاحتساب
   */
  static shouldInvalidateLiveCache(eventType: string): boolean {
    const invalidatingEvents = new Set([
      'LEAVE_RETURNED',
      'LEAVE_OVERDUE_LOGGED',
      'LEAVE_OVERSTAY_PARDONED',
      'DISCIPLINARY_PENALTY_ISSUED',
      'DISCIPLINARY_BONUS_AWARDED',
      'PPE_ASSET_ISSUED',
      'PPE_ASSET_DAMAGED',
      'PPE_ASSET_LOST',
      'ADVANCE_REQUEST_APPROVED',
      'ADVANCE_INSTALLMENT_OVERDUE',
      'ADVANCE_INSTALLMENT_PAID',
    ]);
    return invalidatingEvents.has(eventType);
  }
}
