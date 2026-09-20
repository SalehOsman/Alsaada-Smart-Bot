/**
 * Core types for @alsaada/rbac
 * Zero external runtime dependencies
 */

export type CanonicalRole =
  | 'SUPER_ADMIN'
  | 'GENERAL_ADMIN'
  | 'FIELD_ADMIN'
  | 'WORKER_SUPERVISOR'
  | 'WORKER'
  | 'SUPPLIER'
  | 'GUEST';

export type DashboardAuthorizedRole =
  | 'SUPER_ADMIN'
  | 'GENERAL_ADMIN'
  | 'FIELD_ADMIN';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'submit'
  | 'edit'
  | 'withdraw'
  | 'approve'
  | 'reject'
  | 'settle'
  | 'export'
  | 'print'
  | 'manage';

export type DataScope =
  | 'self'
  | 'assigned-site'
  | 'assigned-resource'
  | 'all-sites'
  | 'system';

export type ChannelKind = 'BOT' | 'DASHBOARD' | 'ALL';

export interface WorkerDelegationContract {
  id?: string;
  userId?: string;
  workerId?: string;
  permissionKey: string;
  siteId: string;
  resourceId?: string | null;
  isActive: boolean;
  startsAt?: Date | string;
  endsAt?: Date | string | null;
}

export interface AccessContext {
  role: CanonicalRole | string;
  permissionKey: string;
  action?: PermissionAction | undefined;
  siteId?: string | null | undefined;
  targetSiteId?: string | null | undefined;
  resourceId?: string | null | undefined;
  isSelf?: boolean | undefined;
  isActive?: boolean | undefined;
  isBanned?: boolean | undefined;
  channel?: ChannelKind | undefined;
  delegations?: WorkerDelegationContract[] | undefined;
}

export interface AccessDecision {
  granted: boolean;
  reason?: string;
  allowedActions?: PermissionAction[];
  fieldMask?: string[];
  scope?: DataScope;
  decisionTrace?: readonly string[];
}

export interface FeatureContract {
  flowCode: string;
  nameAr: string;
  permissionKey: string;
  module: string;
  delegatable: boolean;
  allowedRoles: CanonicalRole[];
  allowedActions: PermissionAction[];
  dataScope: DataScope;
  sensitiveFields?: string[];
  dashboardRoute?: string;
  botCommand?: string;
  analytics?: {
    kpiKeys: string[];
    hasDrilldown: boolean;
  };
}

export type PermissionScopeType = 'ROLE' | 'DEPARTMENT' | 'JOB_TITLE' | 'SITE' | 'USER';

export interface ScopePermissionRule {
  scopeType: PermissionScopeType;
  scopeId: string;
  featureKey: string;
  action: PermissionAction;
  policy: 'ALLOW' | 'DENY';
}

export interface CascadingAccessContext {
  role: CanonicalRole | string;
  userId?: string | undefined;
  departmentId?: string | null | undefined;
  jobTitleId?: string | null | undefined;
  siteId?: string | null | undefined;
  targetSiteId?: string | null | undefined;
  permissionKey: string;
  action?: PermissionAction | undefined;
  resourceId?: string | null | undefined;
  isSelf?: boolean | undefined;
  isActive?: boolean | undefined;
  isBanned?: boolean | undefined;
  isOnLeave?: boolean | undefined;
  freezeBotAccessOnLeave?: boolean | undefined;
  ejectTelegramOnLeave?: boolean | undefined;
  rules?: ScopePermissionRule[] | undefined;
  channel?: ChannelKind | undefined;
  delegations?: WorkerDelegationContract[] | undefined;
}

export type WorkerSupervisorProfileKey =
  | 'FUEL_SUPERVISOR'
  | 'CANTEEN_SUPERVISOR'
  | 'HOUSING_SUPERVISOR'
  | 'SHIFT_SUPERVISOR';

export interface WorkerSupervisorProfile {
  key: WorkerSupervisorProfileKey;
  nameAr: string;
  descriptionAr: string;
  permissions: Array<{
    permissionKey: string;
    actions: PermissionAction[];
  }>;
}
