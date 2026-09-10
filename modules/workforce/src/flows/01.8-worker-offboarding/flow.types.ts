export type TerminationReason =
  | 'RESIGNATION'
  | 'CONTRACT_END'
  | 'MUTUAL_AGREEMENT'
  | 'DISCIPLINARY'
  | 'UNFIT_FOR_WORK';

export const TERMINATION_REASON_LABELS: Record<TerminationReason, string> = {
  RESIGNATION: 'استقالة بناءً على طلب العامل',
  CONTRACT_END: 'انتهاء مدة العقد المبرم',
  MUTUAL_AGREEMENT: 'فسخ العقد بالتراضي بين الطرفين',
  DISCIPLINARY: 'فصل تأديبي لمخالفة اللوائح',
  UNFIT_FOR_WORK: 'عدم اللياقة الصحية أو ظروف قهرية',
};

export interface WorkerOffboardingState {
  step: 'INIT' | 'WORKER_SELECT' | 'REASON_SELECT' | 'CONFIRM' | 'DONE';
  workerId?: string | undefined;
  workerCode?: string | undefined;
  workerName?: string | undefined;
  workerTelegramId?: bigint | null | undefined;
  jobTitle?: string | undefined;
  siteName?: string | undefined;
  reason?: TerminationReason | undefined;
  notes?: string | undefined;
  createdAt: number;
}

export interface WorkerOffboardingInput {
  workerId: string;
  workerCode: string;
  reason: TerminationReason;
  notes?: string | undefined;
  actorTelegramId: bigint;
}

export interface WorkerOffboardingResult {
  success: boolean;
  clearanceReferenceId: string;
  workerName: string;
  workerCode: string;
  demotedTelegramId?: bigint | null | undefined;
  message: string;
}
