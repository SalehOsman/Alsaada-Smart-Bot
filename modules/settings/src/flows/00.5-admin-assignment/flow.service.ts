import type { AdminAssignmentRepository } from './flow.repository.js';
import type { AdminAssignmentDto, SiteOptionDto } from './flow.types.js';
import { validateSiteScope } from './flow.validators.js';

export class AdminAssignmentService {
  constructor(private readonly repository: AdminAssignmentRepository) {}

  async listAdminUsers(excludeTelegramId?: bigint): Promise<AdminAssignmentDto[]> {
    return this.repository.listAdminUsers(excludeTelegramId);
  }

  async getUserAssignment(telegramId: bigint): Promise<AdminAssignmentDto | null> {
    return this.repository.getUserAssignment(telegramId);
  }

  async listActiveSites(): Promise<SiteOptionDto[]> {
    return this.repository.listActiveSites();
  }

  async setAssignment(
    telegramId: bigint,
    siteIdOrGlobal: string,
    actorTelegramId?: bigint
  ): Promise<{ success: boolean; user?: AdminAssignmentDto; error?: string }> {
    // 1. Guard against Self-Modification
    if (actorTelegramId !== undefined && actorTelegramId === telegramId) {
      return {
        success: false,
        error: 'أمان النظام: لا يمكنك تعديل صلاحيات أو نطاق إشراف حسابك الشخصي بنفسك.',
      };
    }

    if (!validateSiteScope(siteIdOrGlobal)) {
      return { success: false, error: 'معرف الموقع غير صالح.' };
    }

    // 2. Guard against Restricting or Demoting the Sole/Last Standing Super Admin
    const targetUser = await this.repository.getUserAssignment(telegramId);
    if (!targetUser) {
      return { success: false, error: 'المشرف المطلوب غير موجود.' };
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      const activeSuperCount = await this.repository.countActiveSuperAdmins();
      if (activeSuperCount <= 1) {
        return {
          success: false,
          error:
            'أمان الحوكمة: لا يمكن تقييد أو تعديل صلاحيات المشرف العام الوحيد بالمنظومة. يجب تعيين سوبر أدمن آخر أولاً لضمان وجود إدارة عليا.',
        };
      }
    }

    const siteId = siteIdOrGlobal === 'GLOBAL' ? null : siteIdOrGlobal;
    const updated = await this.repository.setAssignment(telegramId, siteId);
    return { success: true, user: updated };
  }

  async toggleFreezeBotAccess(
    telegramId: bigint,
    actorTelegramId?: bigint
  ): Promise<{ success: boolean; user?: AdminAssignmentDto; error?: string }> {
    if (actorTelegramId !== undefined && actorTelegramId === telegramId) {
      return { success: false, error: 'أمان النظام: لا يمكنك تعديل سياسة حسابك الشخصي بنفسك.' };
    }
    const updated = await this.repository.toggleFreezeBotAccessOnLeave(telegramId);
    if (!updated) return { success: false, error: 'المشرف المطلوب غير موجود.' };
    return { success: true, user: updated };
  }

  async toggleEjectTelegram(
    telegramId: bigint,
    actorTelegramId?: bigint
  ): Promise<{ success: boolean; user?: AdminAssignmentDto; error?: string }> {
    if (actorTelegramId !== undefined && actorTelegramId === telegramId) {
      return { success: false, error: 'أمان النظام: لا يمكنك تعديل سياسة حسابك الشخصي بنفسك.' };
    }
    const updated = await this.repository.toggleEjectTelegramOnLeave(telegramId);
    if (!updated) return { success: false, error: 'المشرف المطلوب غير موجود.' };
    return { success: true, user: updated };
  }

  async setLeaveStatus(
    telegramId: bigint,
    isOnLeave: boolean,
    actorTelegramId?: bigint,
    actorName?: string
  ): Promise<{ success: boolean; user?: AdminAssignmentDto; error?: string }> {
    if (actorTelegramId !== undefined && actorTelegramId === telegramId) {
      return { success: false, error: 'أمان النظام: لا يمكنك تغيير حالة إجازة حسابك الشخصي بنفسك.' };
    }
    const updated = await this.repository.setLeaveStatus(telegramId, isOnLeave, actorTelegramId, actorName);
    if (!updated) return { success: false, error: 'المشرف المطلوب غير موجود.' };
    return { success: true, user: updated };
  }
}
