import type { GhostModeRepository } from './flow.repository.js';
import type { UserRole } from '../../shared/module.types.js';
import { validateImpersonationRole } from './flow.validators.js';

export class GhostModeService {
  constructor(private readonly repository: GhostModeRepository) {}

  async impersonate(telegramId: bigint, roleInput: string): Promise<{ success: boolean; role?: UserRole; error?: string }> {
    const val = validateImpersonationRole(roleInput);
    if (!val.isValid || !val.role) {
      return { success: false, error: 'الدور المطلوب غير متاح للمحاكاة.' };
    }

    await this.repository.setImpersonatedRole(telegramId, val.role);
    return { success: true, role: val.role };
  }

  async exitImpersonate(telegramId: bigint): Promise<void> {
    await this.repository.clearImpersonatedRole(telegramId);
  }

  async getActiveImpersonation(telegramId: bigint): Promise<UserRole | null> {
    return this.repository.getImpersonatedRole(telegramId);
  }
}
