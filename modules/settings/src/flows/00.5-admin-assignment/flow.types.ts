export interface AdminAssignmentDto {
  id: string;
  telegramId: bigint;
  fullName: string;
  role: string;
  assignedSiteId: string | null;
  assignedSiteName: string | null;
}

export interface SiteOptionDto {
  id: string;
  code: string;
  name: string;
}
