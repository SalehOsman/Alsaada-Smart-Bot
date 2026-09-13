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
  action?: PermissionAction;
  siteId?: string | null;
  targetSiteId?: string | null;
  resourceId?: string | null;
  isSelf?: boolean;
  isActive?: boolean;
  isBanned?: boolean;
  channel?: ChannelKind;
  delegations?: WorkerDelegationContract[];
}

export interface AccessDecision {
  granted: boolean;
  reason?: string;
  allowedActions?: PermissionAction[];
  fieldMask?: string[];
  scope?: DataScope;
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
