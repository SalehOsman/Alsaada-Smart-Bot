import type { UserRole } from '../../shared/module.types.js';

export type ImpersonateRole = Exclude<UserRole, 'SUPER_ADMIN'>;

export interface GhostModeStatusDto {
  isImpersonating: boolean;
  impersonatedRole: UserRole | null;
  entity?: ImpersonatedEntity | null | undefined;
}

export interface ImpersonatedEntity {
  type: 'WORKER' | 'SUPPLIER' | 'SITE';
  id: string;
  name: string;
  code?: string | undefined;
  siteId?: string | undefined;
  siteName?: string | undefined;
}
