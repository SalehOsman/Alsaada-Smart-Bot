export const LINKING_TOKEN_TTL_SECONDS = 86400; // 24 Hours

export interface GuestJoinState {
  step: 'INIT' | 'SEARCH' | 'VERIFY' | 'WAITING_APPROVAL' | 'DONE';
  applicantTelegramId: bigint;
  applicantUsername?: string | undefined;
  applicantFullName?: string | undefined;
  workerCode?: string | undefined;
  workerId?: string | undefined;
  workerName?: string | undefined;
  workerPhone?: string | undefined;
  createdAt: number;
}

export interface CryptographicLinkingPayload {
  workerCode: string;
  applicantTelegramId: bigint;
  expiresAt: number;
  nonce: string;
  signature: string;
}

export interface GuestJoinApplicationResult {
  success: boolean;
  ticketNumber: string;
  workerName: string;
  workerCode: string;
  officialPhone: string;
  message: string;
}

export interface ConsumeLinkingTokenResult {
  success: boolean;
  workerId: string;
  workerName: string;
  workerCode: string;
  jobTitle: string;
  siteName?: string | undefined;
  message: string;
}
