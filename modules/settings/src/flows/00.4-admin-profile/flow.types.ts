export interface AdminProfileDto {
  id: string;
  telegramId: bigint;
  role: string;
  fullName: string | null;
  phone: string | null;
  assignedSiteName?: string | null;
  isActive: boolean;
}

export type AdminFieldKey = 'fullName' | 'phone';

export interface PendingAdminEditState {
  fieldKey: AdminFieldKey;
  promptMessageId: number;
  timestamp: number;
}
