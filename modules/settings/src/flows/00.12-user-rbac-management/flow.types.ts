export interface UserListItemDto {
  id: string;
  telegramId: bigint;
  fullName: string;
  username?: string | null | undefined;
  role: string;
  isActive: boolean;
  isBanned: boolean;
  workerId?: string | null | undefined;
  workerCode?: string | null | undefined;
  workerName?: string | null | undefined;
  assignedSiteId?: string | null | undefined;
  assignedSiteName?: string | null | undefined;
  createdAt: Date;
}

export interface UserDetailDto extends UserListItemDto {
  phoneEncrypted?: string | null | undefined;
  approvedBySuperAdminId?: bigint | null | undefined;
}

export interface WorkerCandidateDto {
  id: string;
  code: string;
  name: string;
  nickname?: string | null | undefined;
  phone?: string | null | undefined;
  telegramId?: bigint | null | undefined;
  siteId?: string | null | undefined;
  siteName?: string | null | undefined;
}

export interface DirectLinkResult {
  success: boolean;
  workerCode: string;
  workerName: string;
  telegramId: bigint;
  telegramName?: string | undefined;
  reboundFromOldUser?: boolean | undefined;
  oldWorkerName?: string | undefined;
  whatsAppUrl?: string | undefined;
  error?: string | undefined;
}

export interface LiveProfilePreview {
  telegramId: bigint;
  exists: boolean;
  firstName?: string | undefined;
  lastName?: string | undefined;
  username?: string | undefined;
  error?: string | undefined;
}

export interface PendingUserRbacAction {
  action: 'SEARCH' | 'ENTER_TELEGRAM_ID' | 'CONFIRM_PREVIEW' | 'CONFIRM_CONFLICT';
  targetWorkerId?: string | undefined;
  targetWorkerCode?: string | undefined;
  targetWorkerName?: string | undefined;
  targetWorkerPhone?: string | undefined;
  targetUserId?: string | undefined;
  targetTelegramId?: bigint | undefined;
  previewName?: string | undefined;
  targetRole?: string | undefined;
  conflictWorkerName?: string | undefined;
  conflictOldWorkerId?: string | undefined;
  createdAt: number;
}
