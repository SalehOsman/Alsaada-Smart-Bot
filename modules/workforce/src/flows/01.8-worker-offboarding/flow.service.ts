import type { WorkerOffboardingRepository } from './flow.repository.js';
import type {
  ClearanceProfile,
  ClearanceFinancialInput,
  ClearanceFinancialBreakdown,
  ClearancePayoutOption,
  NegativeBalanceAction,
  PendingClearanceReport,
  PendingDisciplinaryRecord,
  FieldClearanceReportData,
  FinalizeClearanceData,
  WorkerClearanceResult,
  WorkerOffboardingInput,
  WorkerOffboardingResult,
} from './flow.types.js';
import { validateTerminationReason, validateOffboardingEligibility } from './flow.validators.js';

export interface ClearanceBreakdownWithFlags extends ClearanceFinancialBreakdown {
  hasPendingDecisions: boolean;
}

export interface PayoutOptionValidationResult {
  allowed: boolean;
  forcedOption?: ClearancePayoutOption;
  reason?: string;
}

export interface NegativeBalanceEvaluation {
  isNegative: boolean;
  action: NegativeBalanceAction;
  workerStatus: 'TERMINATED' | 'BLACKLISTED';
  debtAmount: number;
  isDebtWrittenOff: boolean;
  auditMessage: string;
}

/**
 * Calculates financial clearance breakdown matching exact company accounting rules:
 * - dailyRate = worker.dailyWage || (grossSalary > 0 ? Math.round(grossSalary / 30) : 300)
 * - EarnedSalary = Math.round(workedDays * dailyRate)
 * - TotalCredits = EarnedSalary + ApprovedBonuses
 * - TotalDebits = Advances + UnsettledInstallments + Penalties + AssetDamage
 * - NetSettlement = TotalCredits - TotalDebits
 */
export function calculateFinancialClearance(
  profile: ClearanceProfile,
  input: ClearanceFinancialInput
): ClearanceBreakdownWithFlags {
  const gross = (profile.worker.basicSalary || 0) + (profile.worker.fixedAllowances || 0);
  const dailyRate =
    input.dailyRate && input.dailyRate > 0
      ? input.dailyRate
      : profile.worker.dailyWage && profile.worker.dailyWage > 0
      ? profile.worker.dailyWage
      : gross > 0
      ? Math.round(gross / 30)
      : 300;

  const workedDays = Math.max(0, input.workedDays);
  const earnedSalary = Math.round(workedDays * dailyRate);

  // 1. Approved Bonuses
  let approvedBonuses = 0;
  if (profile.approvedDisciplinaryRecords?.length) {
    for (const r of profile.approvedDisciplinaryRecords) {
      if (r.type === 'BONUS_CASH' && r.amount) approvedBonuses += r.amount;
      else if (r.type === 'BONUS_DAYS' && r.daysEquivalent) approvedBonuses += Math.round(r.daysEquivalent * dailyRate);
    }
  } else if (profile.stats && profile.stats.totalApprovedBonuses > 0) {
    approvedBonuses += profile.stats.totalApprovedBonuses;
  } else if (typeof (profile as unknown as Record<string, unknown>).totalBonuses === 'number') {
    approvedBonuses += Number((profile as unknown as Record<string, unknown>).totalBonuses);
  }

  const selectedIds = new Set(input.selectedDisciplinaryDecisions || []);
  if (selectedIds.size > 0 && profile.pendingDisciplinaryRecords) {
    for (const r of profile.pendingDisciplinaryRecords) {
      if (selectedIds.has(r.id)) {
        if (r.type === 'BONUS_CASH' && r.amount) approvedBonuses += r.amount;
        else if (r.type === 'BONUS_DAYS' && r.daysEquivalent) approvedBonuses += Math.round(r.daysEquivalent * dailyRate);
      }
    }
  }
  if (input.customBonusAmount && input.customBonusAmount > 0) approvedBonuses += input.customBonusAmount;
  const totalCredits = earnedSalary + approvedBonuses;

  // 2. Advances & Installments
  let totalAdvances = 0;
  const legacyProfile = profile as unknown as Record<string, unknown>;
  if (typeof legacyProfile.totalAdvances === 'number') {
    const lAdv = legacyProfile.totalAdvances || 0;
    const lInst = typeof legacyProfile.unsettledInstallments === 'number' ? legacyProfile.unsettledInstallments : 0;
    totalAdvances = lAdv + lInst;
  } else if (profile.advances) {
    const instSum = (profile.advances.unsettledInstallments || []).reduce((s, i) => s + Number(i.installmentAmount || 0), 0);
    const outstanding = Number(profile.advances.totalOutstandingAdvances || 0);
    const advObj = profile.advances as unknown as Record<string, unknown>;
    const directAdv = typeof advObj.advances === 'number' ? advObj.advances : (typeof advObj.directAdvances === 'number' ? advObj.directAdvances : 0);
    if (directAdv > 0) totalAdvances = directAdv + instSum;
    else if (outstanding === instSum || instSum === 0) totalAdvances = outstanding;
    else if (outstanding === 0) totalAdvances = instSum;
    else totalAdvances = Math.max(outstanding, instSum);
  }

  // 3. Penalties
  let totalPenalties = 0;
  if (profile.approvedDisciplinaryRecords?.length) {
    for (const r of profile.approvedDisciplinaryRecords) {
      if (r.type === 'PENALTY_CASH' && r.amount) totalPenalties += r.amount;
      else if (r.type === 'PENALTY_DAYS' && r.daysEquivalent) totalPenalties += Math.round(r.daysEquivalent * dailyRate);
    }
  } else if (profile.stats && (profile.stats.totalApprovedPenalties > 0 || profile.stats.totalApprovedPenaltyDays > 0)) {
    totalPenalties += profile.stats.totalApprovedPenalties + Math.round(profile.stats.totalApprovedPenaltyDays * dailyRate);
  } else if (typeof legacyProfile.totalPenalties === 'number') {
    totalPenalties += Number(legacyProfile.totalPenalties);
  } else if (typeof legacyProfile.totalPenaltyAmount === 'number') {
    totalPenalties += Number(legacyProfile.totalPenaltyAmount) + Math.round(Number(legacyProfile.totalPenaltyDays || 0) * dailyRate);
  }

  if (selectedIds.size > 0 && profile.pendingDisciplinaryRecords) {
    for (const r of profile.pendingDisciplinaryRecords) {
      if (selectedIds.has(r.id)) {
        if (r.type === 'PENALTY_CASH' && r.amount) totalPenalties += r.amount;
        else if (r.type === 'PENALTY_DAYS' && r.daysEquivalent) totalPenalties += Math.round(r.daysEquivalent * dailyRate);
      }
    }
  }
  if (input.customPenaltyAmount && input.customPenaltyAmount > 0) totalPenalties += input.customPenaltyAmount;

  // 4. Asset damage, Debits, Net
  const assetDamageDeduction = Math.max(0, Number(input.assetDamageDeduction || 0));
  const totalDebits = totalAdvances + totalPenalties + assetDamageDeduction;
  const netSettlementAmount = totalCredits - totalDebits;
  const isNegativeBalance = netSettlementAmount < 0;

  // 5. Pending decisions
  let hasPendingDecisions = false;
  if (profile.pendingDisciplinaryRecords?.length) {
    hasPendingDecisions = profile.pendingDisciplinaryRecords.some((r) => !selectedIds.has(r.id));
  } else if (
    (profile.stats && (profile.stats.totalPendingPenalties > 0 || profile.stats.totalPendingPenaltyDays > 0 || profile.stats.totalPendingBonuses > 0)) ||
    (typeof legacyProfile.pendingDisciplinaryCount === 'number' && legacyProfile.pendingDisciplinaryCount > 0) ||
    Boolean(legacyProfile.hasPendingDecisions)
  ) {
    hasPendingDecisions = true;
  }

  return {
    earnedSalary,
    workedDays,
    dailyRate,
    approvedBonuses,
    totalCredits,
    totalAdvances,
    totalPenalties,
    assetDamageDeduction,
    totalDebits,
    netSettlementAmount,
    isNegativeBalance,
    hasPendingDecisions,
  };
}

/**
 * Validates payout option under Mandatory Pending Decisions Policy.
 */
export function validatePayoutOption(
  profile: ClearanceProfile,
  chosenOption: ClearancePayoutOption
): PayoutOptionValidationResult {
  const legacy = profile as unknown as Record<string, unknown>;
  const hasPending =
    Boolean(profile.pendingDisciplinaryRecords?.length) ||
    (profile.stats && (profile.stats.totalPendingPenalties > 0 || profile.stats.totalPendingPenaltyDays > 0 || profile.stats.totalPendingBonuses > 0)) ||
    (typeof legacy.pendingDisciplinaryCount === 'number' && legacy.pendingDisciplinaryCount > 0) ||
    Boolean(legacy.hasPendingDecisions);

  if (hasPending) {
    if (chosenOption === 'IMMEDIATE') {
      return {
        allowed: false,
        forcedOption: 'WITH_PAYROLL',
        reason: 'يوجد قرارات إدارية معلقة بحق العامل تمنع الصرف الفوري؛ تم تحويل الصرف إجبارياً إلى مسير الرواتب الشهري.',
      };
    }
    return { allowed: true, forcedOption: 'WITH_PAYROLL' };
  }
  return { allowed: true, forcedOption: chosenOption };
}

/**
 * Evaluates negative balance action and determines worker status and debt recording.
 */
export function evaluateNegativeBalanceAction(
  netSettlementAmount: number,
  action: NegativeBalanceAction
): NegativeBalanceEvaluation {
  if (netSettlementAmount < 0) {
    const debtAmount = Math.abs(netSettlementAmount);
    if (action === 'BLACKLISTED') {
      return {
        isNegative: true,
        action: 'BLACKLISTED',
        workerStatus: 'BLACKLISTED',
        debtAmount,
        isDebtWrittenOff: false,
        auditMessage: `تم تثبيت مديونية قدرها ${debtAmount} ج.م وإدراج العامل بالقائمة السوداء مع حظر إعادة التعيين.`,
      };
    }
    return {
      isNegative: true,
      action: 'WRITTEN_OFF',
      workerStatus: 'TERMINATED',
      debtAmount,
      isDebtWrittenOff: true,
      auditMessage: `تم إسقاط المديونية البالغة ${debtAmount} ج.م ودياً وإنهاء الخدمة بالتراضي الإداري والشطب المالي.`,
    };
  }
  return {
    isNegative: false,
    action,
    workerStatus: 'TERMINATED',
    debtAmount: 0,
    isDebtWrittenOff: false,
    auditMessage: 'المخالصة ذات رصيد إيجابي أو صفري ولا تتطلب إجراء مديونية عكسية.',
  };
}

/**
 * Strips all financial figures from ClearanceProfile when viewed by FIELD_ADMIN or unauthorized roles.
 */
export function sanitizeProfileForRole(profile: ClearanceProfile, role: string): ClearanceProfile {
  if (['SUPER_ADMIN', 'ACCOUNTANT'].includes(role)) {
    return profile;
  }
  return {
    worker: {
      ...profile.worker,
      dailyWage: 0,
      basicSalary: 0,
      fixedAllowances: 0,
    },
    activeLeave: profile.activeLeave ? { ...profile.activeLeave } : null,
    ppeAssets: profile.ppeAssets.map((a) => ({ ...a, costPrice: 0, deductionAmount: 0 })),
    advances: { totalOutstandingAdvances: 0, unsettledInstallments: [] },
    pendingDisciplinaryRecords: profile.pendingDisciplinaryRecords.map((r) => ({
      ...r,
      amount: null,
      daysEquivalent: null,
    })),
    approvedDisciplinaryRecords: profile.approvedDisciplinaryRecords?.map((r) => ({
      ...r,
      amount: null,
      daysEquivalent: null,
    })),
    stats: undefined,
  };
}

// ============================================================================
// Service Class
// ============================================================================

export class WorkerOffboardingService {
  constructor(
    private readonly repository: WorkerOffboardingRepository,
    private readonly onWorkerDemoted?: (demotedTelegramId: bigint) => Promise<void>
  ) {}

  async getActiveWorkers(siteId?: string) {
    return this.repository.getActiveWorkers(siteId);
  }

  async getWorkerById(workerId: string) {
    return this.repository.getWorkerById(workerId);
  }

  async executeOffboarding(input: WorkerOffboardingInput): Promise<WorkerOffboardingResult> {
    if (!validateTerminationReason(input.reason)) {
      throw new Error('سبب إنهاء الخدمة المحدد غير معتمد.');
    }
    const worker = await this.repository.getWorkerById(input.workerId);
    if (!worker) {
      throw new Error('لم يتم العثور على سجل العامل المطلوب إنهاء خدمته.');
    }
    const eligibility = validateOffboardingEligibility(worker.status);
    if (!eligibility.eligible) {
      throw new Error(eligibility.error || 'العامل غير مؤهل للمخالصة.');
    }
    const result = await this.repository.terminateWorker(input);
    if (result.demotedTelegramId && this.onWorkerDemoted) {
      await this.onWorkerDemoted(result.demotedTelegramId);
    }
    return result;
  }

  calculateFinancialClearance(profile: ClearanceProfile, input: ClearanceFinancialInput): ClearanceBreakdownWithFlags {
    return calculateFinancialClearance(profile, input);
  }

  validatePayoutOption(profile: ClearanceProfile, chosenOption: ClearancePayoutOption): PayoutOptionValidationResult {
    return validatePayoutOption(profile, chosenOption);
  }

  evaluateNegativeBalanceAction(netSettlementAmount: number, action: NegativeBalanceAction): NegativeBalanceEvaluation {
    return evaluateNegativeBalanceAction(netSettlementAmount, action);
  }

  sanitizeProfileForRole(profile: ClearanceProfile, role: string): ClearanceProfile {
    return sanitizeProfileForRole(profile, role);
  }

  async getWorkerClearanceProfile(workerId: string, role?: string): Promise<ClearanceProfile> {
    const profile = await this.repository.getWorkerClearanceProfile(workerId);
    return role ? sanitizeProfileForRole(profile, role) : profile;
  }

  async getPendingClearanceReports(): Promise<PendingClearanceReport[]> {
    return this.repository.getPendingClearanceReports();
  }

  async getPendingDisciplinaryDecisions(workerId?: string): Promise<PendingDisciplinaryRecord[]> {
    return this.repository.getPendingDisciplinaryDecisions(workerId);
  }

  async settleDisciplinaryDecision(
    id: string,
    action: 'APPROVE' | 'REJECT' | 'ADJUST',
    actorId: string,
    amount?: number,
    days?: number
  ): Promise<void> {
    return this.repository.settleDisciplinaryDecision(id, action, actorId, amount, days);
  }

  async submitFieldClearanceReport(data: FieldClearanceReportData, userRole: string): Promise<string> {
    if (!['FIELD_ADMIN', 'SUPER_ADMIN', 'GENERAL_ADMIN', 'EXECUTIVE'].includes(userRole)) {
      throw new Error('غير مصرح للمستخدم برفع تقرير إخلاء طرف ميداني.');
    }
    return this.repository.submitFieldClearanceReport(data);
  }

  async finalizeWorkerClearance(data: FinalizeClearanceData, userRole: string): Promise<WorkerClearanceResult> {
    if (userRole !== 'SUPER_ADMIN') {
      throw new Error('اعتماد المخالصة المالية وإصدار السند النهائي من الاختصاص السيادي الحصري للمدير العام (SUPER_ADMIN).');
    }
    const profile = await this.repository.getWorkerClearanceProfile(data.workerId);
    const hasPending =
      Boolean(profile.pendingDisciplinaryRecords?.length) ||
      Boolean(profile.stats && (profile.stats.totalPendingPenalties > 0 || profile.stats.totalPendingPenaltyDays > 0 || profile.stats.totalPendingBonuses > 0));

    if (hasPending) {
      if (data.payoutOption === 'IMMEDIATE') {
        throw new Error('لا يمكن صرف المخالصة فورياً لوجود قرارات إدارية معلقة بحق العامل؛ تم فرض الصرف مع مسير الرواتب.');
      }
      data.payoutOption = 'WITH_PAYROLL';
    }

    if (data.netSettlementAmount < 0 && !data.negativeBalanceAction) {
      throw new Error('يجب تحديد الإجراء الإداري للمديونية السالبة (إسقاط وتراضي أو إدراج بالقائمة السوداء).');
    }

    const result = await this.repository.finalizeWorkerClearance(data);
    if (result.demotedTelegramId && this.onWorkerDemoted) {
      await this.onWorkerDemoted(result.demotedTelegramId);
    }
    return result;
  }
}
