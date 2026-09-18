export interface AdminAssignmentDto {
  id: string;
  telegramId: bigint;
  fullName: string;
  role: string;
  assignedSiteId: string | null;
  assignedSiteName: string | null;
  isOnLeave: boolean;
  freezeBotAccessOnLeave: boolean;
  ejectTelegramOnLeave: boolean;
  status: string;
}

export interface SiteOptionDto {
  id: string;
  code: string;
  name: string;
  workersCount?: number;
}
