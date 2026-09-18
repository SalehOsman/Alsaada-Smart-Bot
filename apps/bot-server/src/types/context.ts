import { Context } from 'grammy';
import type { User } from '@alsaada/database';

export interface ImpersonatedEntityInfo {
  type: 'WORKER' | 'SUPPLIER' | 'SITE';
  id: string;
  name: string;
  code?: string;
  siteId?: string;
  siteName?: string;
}

export interface MyContext extends Context {
  dbUser?: User;
  effectiveRole?: string;
  isRealSuperAdmin?: boolean;
  isImpersonating?: boolean;
  isDualWorkerMode?: boolean;
  impersonatedEntity?: ImpersonatedEntityInfo;
  workerId?: string;
  workerCode?: string;
  assignedSiteId?: string;
  traceId?: string;
  module?: string;
  flowId?: string;
  cacheSource?: string;
  isBanned?: boolean;
}


