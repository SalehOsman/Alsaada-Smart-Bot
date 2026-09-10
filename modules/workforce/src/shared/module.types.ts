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
  effectiveRole?: UserRole | string | undefined;
  isRealSuperAdmin?: boolean | undefined;
  isImpersonating?: boolean | undefined;
  assignedSiteId?: string | null | undefined;
  workerId?: string | null | undefined;
  workerCode?: string | null | undefined;
  adminSites?: string[] | undefined;
  session?: {
    userMode?: string | undefined;
    [key: string]: unknown;
  } | undefined;
}

