import type { UserRole } from '../../shared/module.types.js';

export type ImpersonateRole = Exclude<UserRole, 'SUPER_ADMIN'>;

export interface GhostModeStatusDto {
  isImpersonating: boolean;
  impersonatedRole: UserRole | null;
}
