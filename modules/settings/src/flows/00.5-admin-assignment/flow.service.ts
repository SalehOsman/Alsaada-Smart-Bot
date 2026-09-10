import type { AdminAssignmentRepository } from './flow.repository.js';
import type { AdminAssignmentDto, SiteOptionDto } from './flow.types.js';
import { validateSiteScope } from './flow.validators.js';

export class AdminAssignmentService {
  constructor(private readonly repository: AdminAssignmentRepository) {}

  async listAdminUsers(): Promise<AdminAssignmentDto[]> {
    return this.repository.listAdminUsers();
  }

  async getUserAssignment(telegramId: bigint): Promise<AdminAssignmentDto | null> {
    return this.repository.getUserAssignment(telegramId);
  }

  async listActiveSites(): Promise<SiteOptionDto[]> {
    return this.repository.listActiveSites();
  }

  async setAssignment(
    telegramId: bigint,
    siteIdOrGlobal: string
  ): Promise<{ success: boolean; user?: AdminAssignmentDto; error?: string }> {
    if (!validateSiteScope(siteIdOrGlobal)) {
      return { success: false, error: 'معرف الموقع غير صالح.' };
    }

    const siteId = siteIdOrGlobal === 'GLOBAL' ? null : siteIdOrGlobal;
    const updated = await this.repository.setAssignment(telegramId, siteId);
    return { success: true, user: updated };
  }
}
