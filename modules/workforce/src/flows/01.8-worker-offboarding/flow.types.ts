/**
 * 01.8 Worker Offboarding & Financial Clearance — Domain Types & Contracts
 * Baseline SSOT: F:\HR\src\bot\conversations\end-of-service.conversation.ts
 * Master Plan 14: Worker Offboarding, Financial Clearance & Sovereign Demotion Engine
 */

// ============================================================================
// 1. Offboarding Reasons & Classifications
// ============================================================================

export type TerminationReason =
  | 'RESIGNATION'
  | 'CONTRACT_END'
  | 'MUTUAL_AGREEMENT'
  | 'DISCIPLINARY'
  | 'UNFIT_FOR_WORK'
  | 'TERMINATION_PERFORMANCE'
  | 'TERMINATION_DISCIPLINARY'
  | 'END_OF_CONTRACT'
  | 'OTHER';

export const TERMINATION_REASON_LABELS: Record<TerminationReason, string> = {
  RESIGNATION: 'استقالة بناءً على طلب العامل',
  CONTRACT_END: 'انتهاء مدة العقد المبرم',
  MUTUAL_AGREEMENT: 'فسخ العقد بالتراضي بين الطرفين',
  DISCIPLINARY: 'فصل تأديبي لمخالفة اللوائح',
  UNFIT_FOR_WORK: 'عدم اللياقة الصحية أو ظروف قهرية',
  TERMINATION_PERFORMANCE: 'إنهاء خدمة لضعف الكفاءة / عدم اجتياز التجربة',
  TERMINATION_DISCIPLINARY: 'فصل تأديبي لمخالفة لوائح العمل والسلامة',
  END_OF_CONTRACT: 'انتهاء مدة العقد المبرم رسمياً',
  OTHER: 'أسباب أخرى / ظروف قهرية طارئة',
};

export type OffboardReason =
  | 'RESIGNATION'
  | 'TERMINATION_PERFORMANCE'
  | 'TERMINATION_DISCIPLINARY'
  | 'MUTUAL_AGREEMENT'
  | 'END_OF_CONTRACT'
  | 'OTHER';

export const OFFBOARD_REASON_LABELS: Record<OffboardReason, string> = {
  RESIGNATION: 'استقالة بناءً على طلب العامل',
  TERMINATION_PERFORMANCE: 'إنهاء خدمة لضعف الكفاءة / عدم اجتياز التجربة',
  TERMINATION_DISCIPLINARY: 'فصل تأديبي لمخالفة لوائح العمل والسلامة',
  MUTUAL_AGREEMENT: 'فسخ العقد بالتراضي بين الطرفين',
  END_OF_CONTRACT: 'انتهاء مدة العقد المبرم رسمياً',
  OTHER: 'أسباب أخرى / ظروف قهرية طارئة',
};

// ============================================================================
// 2. Financial Governance & Payout Options
// ============================================================================

export type ClearancePayoutOption = 'IMMEDIATE' | 'WITH_PAYROLL';

export const CLEARANCE_PAYOUT_LABELS: Record<ClearancePayoutOption, string> = {
  IMMEDIATE: 'صرف فوري نقدي وإقفال نهائي للحساب',
  WITH_PAYROLL: 'مجدول للصرف مع مسير الرواتب الشهري المعتاد',
};

export type NegativeBalanceAction = 'WRITTEN_OFF' | 'BLACKLISTED';

export const NEGATIVE_BALANCE_LABELS: Record<NegativeBalanceAction, string> = {
  WRITTEN_OFF: 'إسقاط وتراضي إداري (شطب الدين ودياً)',
  BLACKLISTED: 'تثبيت مديونية وإدراج بالقائمة السوداء مع حظر إعادة التعيين',
};

// ============================================================================
// 3. Domain Sub-Entities (PPE, Disciplinary, Leaves, Advances)
// ============================================================================

export interface PendingDisciplinaryRecord {
  id: string;
  recordNumber: string;
  type: 'BONUS_CASH' | 'BONUS_DAYS' | 'PENALTY_CASH' | 'PENALTY_DAYS' | string;
  amount: number | null;
  daysEquivalent: number | null;
  reason: string;
  decisionDate?: Date | undefined;
  appliedToMonth?: string | null | undefined;
  createdAt: Date;
  requesterName?: string | null | undefined;
  workerId?: string | undefined;
  workerName?: string | undefined;
  workerCode?: string | undefined;
}

export interface ClearancePPEAsset {
  id: string;
  voucherId?: string | undefined;
  assetType: string;
  name: string;
  condition: 'NEW' | 'GOOD' | 'DAMAGED_NATURAL' | 'LOST_NEGLIGENT' | string;
  costPrice: number;
  isDamagedOrLost: boolean;
  deductionAmount: number;
  photoUri?: string | null | undefined;
  returnDate?: Date | null | undefined;
  issueDate?: Date | undefined;
}

export interface ClearanceFinancialBreakdown {
  earnedSalary: number;
  workedDays: number;
  dailyRate: number;
  approvedBonuses: number;
  totalCredits: number;
  totalAdvances: number;
  totalPenalties: number;
  assetDamageDeduction: number;
  totalDebits: number;
  netSettlementAmount: number;
  isNegativeBalance: boolean;
}

export interface ClearanceFinancialInput {
  workedDays: number;
  dailyRate?: number | undefined;
  assetDamageDeduction?: number | undefined;
  selectedDisciplinaryDecisions?: string[] | undefined;
  customBonusAmount?: number | undefined;
  customPenaltyAmount?: number | undefined;
}

export interface ClearanceProfile {
  worker: {
    id: string;
    code: string;
    legacyCode?: string | null | undefined;
    name: string;
    nickname?: string | null | undefined;
    jobTitle?: string | null | undefined;
    dailyWage: number;
    basicSalary: number;
    fixedAllowances?: number | undefined;
    status: string;
    telegramId?: bigint | null | undefined;
    siteId?: string | null | undefined;
    siteName?: string | null | undefined;
    departmentName?: string | null | undefined;
    hireDate?: Date | null | undefined;
    shiftSystem?: string | undefined;
  };
  activeLeave: {
    id: string;
    leaveNumber: string;
    leaveType: string;
    departureDate: Date;
    expectedReturnDate: Date;
    actualReturnDate: Date | null;
    status: string;
    daysBeforeLeave?: number | undefined;
    daysUntilExpectedReturn?: number | undefined;
    overdueDays?: number | undefined;
  } | null;
  ppeAssets: ClearancePPEAsset[];
  advances: {
    totalOutstandingAdvances: number;
    unsettledInstallments: Array<{
      id: string;
      originalVoucherNumber: string;
      installmentSequence?: number | undefined;
      dueMonth?: string | undefined;
      installmentAmount: number;
      status: string;
      dueDate?: Date | null | undefined;
    }>;
  };
  pendingDisciplinaryRecords: PendingDisciplinaryRecord[];
  approvedDisciplinaryRecords?: PendingDisciplinaryRecord[] | undefined;
  stats?: {
    totalApprovedBonuses: number;
    totalApprovedPenalties: number;
    totalApprovedPenaltyDays: number;
    totalPendingBonuses: number;
    totalPendingPenalties: number;
    totalPendingPenaltyDays: number;
  } | undefined;
}

// ============================================================================
// 4. Session & Wizard State
// ============================================================================

export type OffboardStep =
  | 'INIT'
  | 'HUB_SELECT'
  | 'WORKER_SELECT'
  | 'PENDING_RADAR'
  | 'PENDING_DECISIONS_INBOX'
  | 'CUSTOM_PENDING_SELECT'
  | 'TERMINATION_REASON'
  | 'REASON_SELECT'
  | 'PPE_AUDIT'
  | 'PPE_PHOTO_UPLOAD'
  | 'WORKED_DAYS'
  | 'PAYOUT_OPTION'
  | 'NEGATIVE_BALANCE_RADAR'
  | 'CONFIRMATION'
  | 'CONFIRM'
  | 'DONE'
  | 'COMPLETED';

export interface PPESettlementItem {
  id: string;
  condition: 'GOOD' | 'DAMAGED_NATURAL' | 'LOST_NEGLIGENT';
  deductionAmount?: number | undefined;
  photoUri?: string | null | undefined;
}

export interface OffboardSessionData {
  step: OffboardStep;
  workerId?: string | undefined;
  workerCode?: string | undefined;
  workerName?: string | undefined;
  workerNickname?: string | undefined;
  workerTelegramId?: bigint | null | undefined;
  jobTitle?: string | undefined;
  siteName?: string | undefined;
  siteId?: string | undefined;
  reason?: TerminationReason | undefined;
  notes?: string | undefined;
  workedDays?: number | undefined;
  dailyRate?: number | undefined;
  earnedSalary?: number | undefined;
  profile?: ClearanceProfile | undefined;
  financialBreakdown?: ClearanceFinancialBreakdown | undefined;
  selectedDisciplinaryAction?: 'APPROVE_ALL' | 'REJECT_ALL' | 'CUSTOM' | 'DEFER' | undefined;
  customSelectedDecisionIds?: string[] | undefined;
  ppeObservations?: string | undefined;
  ppeDeductions?: number | undefined;
  ppeSettlements?: PPESettlementItem[] | undefined;
  damagedPpeAssetIds?: string[] | undefined;
  ppePhotoUri?: string | null | undefined;
  payoutOption?: ClearancePayoutOption | undefined;
  negativeBalanceAction?: NegativeBalanceAction | undefined;
  clearanceReferenceId?: string | undefined;
  clearanceNumber?: string | undefined;
  createdAt: number;
  backStack?: OffboardStep[] | undefined;
}

export type WorkerOffboardingState = OffboardSessionData;

// ============================================================================
// 5. Data Transfer Objects (DTOs)
// ============================================================================

export interface WorkerOffboardingInput {
  workerId: string;
  workerCode: string;
  reason: TerminationReason | OffboardReason;
  notes?: string | undefined;
  actorTelegramId: bigint;
}

export interface FinalizeClearanceData {
  workerId: string;
  workerCode?: string | undefined;
  workerName?: string | undefined;
  clearanceNumber?: string | undefined;
  terminationDate?: Date | undefined;
  serviceDurationDays?: number | undefined;
  accruedLeaveDays?: number | undefined;
  endOfServiceGratuity?: number | undefined;
  workedDays?: number | undefined;
  dailyRate?: number | undefined;
  earnedSalary: number;
  approvedBonuses?: number | undefined;
  totalAdvances: number;
  totalPenalties?: number | undefined;
  assetDamageDeduction?: number | undefined;
  custodiesReturned?: boolean | undefined;
  ppeReturned?: boolean | undefined;
  netSettlementAmount: number;
  paymentVoucherNumber?: string | null | undefined;
  receiptPhotoUri?: string | null | undefined;
  photoUri?: string | null | undefined;
  sha256Checksum?: string | null | undefined;
  reason: string;
  notes?: string | null | undefined;
  negativeBalanceAction?: NegativeBalanceAction | null | undefined;
  payoutOption?: ClearancePayoutOption | undefined;
  actorTelegramId: bigint;
  ppeSettlements?: PPESettlementItem[] | undefined;
}

export interface FieldClearanceReportData {
  workerId: string;
  workerCode?: string | undefined;
  workedDays: number;
  reason: string;
  ppeObservations?: string | null | undefined;
  photoUri?: string | null | undefined;
  notes?: string | null | undefined;
  submitterTelegramId?: bigint | undefined;
  submittedByUserId?: bigint | string | undefined;
  siteId?: string | null | undefined;
}

export interface PendingClearanceReport {
  id: string;
  ticketNumber: string;
  workerId: string;
  workerCode?: string | undefined;
  workerName?: string | undefined;
  workerNickname?: string | undefined;
  siteName?: string | null | undefined;
  workedDays?: number | undefined;
  reason?: string | undefined;
  ppeObservations?: string | null | undefined;
  notes?: string | null | undefined;
  requestedByTelegramId: bigint;
  createdAt: Date;
  status: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface WorkerClearanceResult {
  success: boolean;
  clearanceNumber: string;
  clearanceReferenceId: string;
  workerId: string;
  workerName: string;
  workerCode: string;
  demotedTelegramId?: bigint | null | undefined;
  netSettlementAmount: number;
  payoutOption: ClearancePayoutOption;
  status: string;
  sha256Checksum?: string | null | undefined;
  message: string;
}

export interface WorkerOffboardingResult {
  success: boolean;
  clearanceReferenceId: string;
  clearanceNumber?: string | undefined;
  workerName: string;
  workerCode: string;
  demotedTelegramId?: bigint | null | undefined;
  message: string;
}
