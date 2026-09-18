export type BotNodeType = 'MODULE' | 'SECTION' | 'SUB_SECTION' | 'FLOW' | 'BUTTON';
export const BotNodeType = {
  MODULE: 'MODULE',
  SECTION: 'SECTION',
  SUB_SECTION: 'SUB_SECTION',
  FLOW: 'FLOW',
  BUTTON: 'BUTTON',
} as const;

export type BotNodeStatus = 'ACTIVE' | 'DISABLED' | 'MAINTENANCE' | 'ARCHIVED';
export const BotNodeStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  MAINTENANCE: 'MAINTENANCE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type DisabledBehavior = 'HIDE' | 'LOCK_WITH_ALERT';
export const DisabledBehavior = {
  HIDE: 'HIDE',
  LOCK_WITH_ALERT: 'LOCK_WITH_ALERT',
} as const;

export interface BotMenuNodeDTO {
  id: string;
  code: string;
  parentId: string | null;
  type: BotNodeType;
  title: string;
  icon: string | null;
  callbackData: string | null;
  status: BotNodeStatus;
  disabledBehavior: DisabledBehavior;
  maintenanceMessage: string | null;
  sortOrder: number;
  isProtected: boolean;
  allowedRoles: string[];
  metadata?: Record<string, unknown> | null;
  children?: BotMenuNodeDTO[];
}

export interface FeatureGateCheckResult {
  allowed: boolean;
  status: BotNodeStatus;
  behavior?: DisabledBehavior;
  maintenanceMessage?: string;
  isProtected: boolean;
  reason?: 'INACTIVE' | 'MAINTENANCE' | 'ROLE_UNAUTHORIZED' | 'NOT_FOUND';
}

export interface BotMenuFilterOptions {
  role?: string;
  parentCode?: string | null;
  includeDisabled?: boolean;
}

export interface ReorderNodeInput {
  id: string;
  sortOrder: number;
  parentId?: string | null;
}
