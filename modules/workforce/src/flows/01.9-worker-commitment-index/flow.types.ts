import type {
  WorkerCommitmentResult,
  WorkerCommitmentInput,
  CommitmentTier,
  CommitmentBreakdown,
  WorkerItem,
  PaginationState,
} from '@alsaada/core-components';

export type { WorkerCommitmentResult, WorkerCommitmentInput, CommitmentTier, CommitmentBreakdown };

export interface WorkerCommitmentPickerItem extends WorkerItem {
  score?: number | undefined;
  tier?: CommitmentTier | undefined;
  tierBadge: string;
  hasEvaluation: boolean;
}

export interface WorkerPickerResult {
  items: WorkerCommitmentPickerItem[];
  pagination: PaginationState;
  rawMatchingCount: number;
  singleMatch: WorkerCommitmentPickerItem | null;
  siteName?: string | undefined;
}

export interface CommitmentScoreListItem {
  workerId: string;
  workerCode: string;
  workerName: string;
  nickname?: string | null | undefined;
  siteId?: string | null | undefined;
  siteName?: string | null | undefined;
  jobTitle?: string | null | undefined;
  contractType: string;
  totalScore: number;
  tier: CommitmentTier;
  tierBadge: string;
  tierArabic: string;
  leaveShiftScore: number;
  disciplinaryScore: number;
  ppeScore: number;
  financialScore: number;
}

export interface CommitmentListFilter {
  siteId?: string | undefined;
  tier?: CommitmentTier | undefined;
  maxScore?: number | undefined;
  minScore?: number | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface CommitmentListResult {
  items: CommitmentScoreListItem[];
  total: number;
  page: number;
  totalPages: number;
  siteId?: string | undefined;
}

export interface CommitmentStatsSummary {
  totalEvaluated: number;
  committedCount: number;
  moderateCount: number;
  underReviewCount: number;
  probationCount: number;
  averageScore: number;
}
