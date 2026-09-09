export type ApprovalStatus =
  | 'PENDING_SUPERVISOR'
  | 'PENDING_PROJECT_MANAGER'
  | 'PENDING_HR'
  | 'PENDING_GENERAL_MANAGER'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface ApprovalTicket {
  id: string;
  requestId: string;
  domain: string; // e.g. ADVANCE, LEAVE_EXTEND, CLEARANCE, CUSTODY_SETTLE
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  targetWorkerCode?: string | undefined;
  targetWorkerName?: string | undefined;
  amountOrDetails: string;
  reason: string;
  currentStatus: ApprovalStatus;
  approvalHistory: {
    actorRole: string;
    actorName: string;
    decision: 'APPROVE' | 'REJECT';
    timestamp: number;
    notes?: string | undefined;
  }[];
  createdAt: number;
}

export interface ApprovalDecisionInput {
  ticket: ApprovalTicket;
  actorTelegramId: bigint;
  actorName: string;
  actorRole: string;
  decision: 'APPROVE' | 'REJECT';
  rejectionReason?: string | undefined;
}

export interface ApprovalDecisionResult {
  success: boolean;
  newStatus: ApprovalStatus;
  isFullyApproved: boolean;
  isRejected: boolean;
  messageArabic: string;
  errorArabic?: string | undefined;
}
