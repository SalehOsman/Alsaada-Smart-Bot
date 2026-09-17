export type CommitmentTier = 'COMMITTED' | 'MODERATE' | 'UNDER_REVIEW' | 'PROBATION';

export interface LeaveEvaluationRecord {
  departureDate: Date;
  expectedReturnDate: Date;
  actualReturnDate?: Date | null | undefined;
  overdueDays: number;
  isOverstayPardoned?: boolean | undefined;
  overstayPardonReason?: string | null | undefined;
  status: string;
}

export interface DisciplinaryEvaluationRecord {
  type: string; // 'BONUS_CASH' | 'BONUS_DAYS' | 'PENALTY_CASH' | 'PENALTY_DAYS'
  decisionDate: Date;
  reason?: string | null | undefined;
  amount?: number | null | undefined;
  daysEquivalent?: number | null | undefined;
}

export interface PpeEvaluationRecord {
  assetType: string;
  condition: string; // 'NEW' | 'GOOD' | 'DAMAGED_NATURAL' | 'LOST_NEGLIGENT'
  status: string; // 'ACTIVE' | 'RETIRED' | 'LOST' | 'DAMAGED'
  isDeductedFromWorker?: boolean | undefined;
}

export interface AdvanceEvaluationRecord {
  amountRequested: number;
  approvedAmount?: number | null | undefined;
  status: string; // 'PENDING' | 'APPROVED' | 'REJECTED'
  hasOverdueInstallments?: boolean | undefined;
  overdueInstallmentsCount?: number | undefined;
}

export interface WorkerCommitmentInput {
  workerId: string;
  workerName: string;
  nickname?: string | null | undefined;
  workerCode: string;
  contractType: string; // 'PERMANENT' | 'DAILY_LABOR' | 'SEASONAL'
  hireDate: Date;
  siteId?: string | null | undefined;
  siteName?: string | null | undefined;
  jobTitle?: string | null | undefined;
  evaluationDate?: Date | undefined;
  periodStart: Date;
  periodEnd: Date;
  leaves?: LeaveEvaluationRecord[] | undefined;
  disciplinaryRecords?: DisciplinaryEvaluationRecord[] | undefined;
  ppeAssets?: PpeEvaluationRecord[] | undefined;
  advanceRecords?: AdvanceEvaluationRecord[] | undefined;
  // For daily labor:
  scheduledDays?: number | undefined;
  attendedDays?: number | undefined;
  unexcusedAbsenceDays?: number | undefined;
}

export interface CommitmentBreakdown {
  leaveShiftScore: number; // max 40
  disciplinaryScore: number; // max 30
  ppeScore: number; // max 15
  financialScore: number; // max 15
  rawScore: number; // 0 - 100
  totalScore: number; // 0 - 100
  tier: CommitmentTier;
  tierArabic: string;
  tierBadge: string;
  isProbation: boolean;
  unexcusedAbsenceDays: number;
  excusedDelaysCount: number;
  penaltiesCount: number;
  bonusesCount: number;
  damagedPpeCount: number;
  financialDefaultsCount: number;
  recoveryGuidance: string[];
  sha256Checksum: string;
}

export interface WorkerCommitmentResult {
  workerId: string;
  workerName: string;
  nickname?: string | null | undefined;
  workerCode: string;
  contractTypeEvaluated: string;
  siteId?: string | null | undefined;
  siteName?: string | null | undefined;
  jobTitle?: string | null | undefined;
  evaluationDate: Date;
  periodStart: Date;
  periodEnd: Date;
  totalScore: number;
  tier: CommitmentTier;
  tierArabic: string;
  tierBadge: string;
  leaveShiftScore: number;
  disciplinaryScore: number;
  ppeScore: number;
  financialScore: number;
  breakdown: CommitmentBreakdown;
  recoveryGuidance: string;
  sha256Checksum: string;
}
