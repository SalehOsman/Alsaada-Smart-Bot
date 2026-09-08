import type { Context } from 'grammy';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'GENERAL_ADMIN'
  | 'FIELD_ADMIN'
  | 'ACCOUNTANT'
  | 'EXECUTIVE'
  | 'WORKER'
  | 'SUPPLIER'
  | 'GUEST';

export interface WorkforceModuleContext extends Context {
  effectiveRole?: UserRole;
  isRealSuperAdmin?: boolean;
  assignedSiteId?: string | null;
  adminSites?: string[];
}
