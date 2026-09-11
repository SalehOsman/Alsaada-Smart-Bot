import type { UserRbacRepository } from './flow.repository.js';
import type {
  UserListItemDto,
  UserDetailDto,
  WorkerCandidateDto,
  DirectLinkResult,
  LiveProfilePreview,
  PendingUserRbacAction,
} from './flow.types.js';
import { validateRole, validateTelegramId, validateSearchQuery } from './flow.validators.js';

export function buildWorkerWhatsAppLaunchUrl(
  workerName: string,
  officialPhone: string,
  botUsername = 'AlsaadaSmartBot'
): string {
  let cleanPhone = officialPhone.replace(/\D/g, '');
  if (cleanPhone.startsWith('01')) {
    cleanPhone = `20${cleanPhone.substring(1)}`;
  } else if (!cleanPhone.startsWith('20') && cleanPhone.length === 10) {
    cleanPhone = `20${cleanPhone}`;
  }

  const message =
    `أهلاً بك يا زميلنا/ ${workerName} 👋\n` +
    `تم تفعيل واعتماد حسابك رسمياً بمنظومة شركة السعادة للمقاولات العامة.\n\n` +
    `اضغط الرابط التالي لبدء استخدام البوابة الذاتية للعاملين:\n` +
    `https://t.me/${botUsername}?start=worker`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export class UserRbacService {
  constructor(private readonly repository: UserRbacRepository) {}

  async listUsers(page = 1, limit = 8) {
    return this.repository.listUsers(page, limit);
  }

  async searchUsers(query: string): Promise<UserListItemDto[]> {
    if (!validateSearchQuery(query)) return [];
    return this.repository.searchUsers(query);
  }

  async getUser(telegramId: bigint): Promise<UserDetailDto | null> {
    return this.repository.getUserByTelegramId(telegramId);
  }

  async listUnlinkedWorkers(): Promise<WorkerCandidateDto[]> {
    return this.repository.listUnlinkedWorkers();
  }

  async findWorkerById(workerId: string): Promise<WorkerCandidateDto | null> {
    return this.repository.findWorkerById(workerId);
  }

  async changeUserRole(
    actorTelegramId: bigint,
    targetTelegramId: bigint,
    newRole: string,
    assignedSiteId?: string | null
  ): Promise<{ success: boolean; user?: UserDetailDto; error?: string }> {
    // 1. Guard against Self-Modification
    if (actorTelegramId === targetTelegramId) {
      return {
        success: false,
        error: 'أمان النظام: لا يمكنك تعديل رتبة أو صلاحيات حسابك الشخصي بنفسك.',
      };
    }

    if (!validateRole(newRole)) {
      return { success: false, error: 'الرتبة المحددة غير معتمدة بنظام الصلاحيات.' };
    }

    // 2. Guard against Demoting the Sole/Last Standing Super Admin
    const targetUser = await this.repository.getUserByTelegramId(targetTelegramId);
    if (!targetUser) {
      return { success: false, error: 'المستخدم المطلوب غير موجود.' };
    }

    if (targetUser.role === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
      const activeSuperCount = await this.repository.countActiveSuperAdmins();
      if (activeSuperCount <= 1) {
        return {
          success: false,
          error:
            'أمان الحوكمة: لا يمكن خفض صلاحية المشرف العام الوحيد بالمنظومة. يجب تعيين سوبر أدمن آخر أولاً.',
        };
      }
    }

    const updated = await this.repository.changeUserRole(targetTelegramId, newRole, assignedSiteId);
    return { success: true, user: updated };
  }

  async toggleUserBan(
    actorTelegramId: bigint,
    targetTelegramId: bigint,
    isBanned: boolean
  ): Promise<{ success: boolean; user?: UserDetailDto; error?: string }> {
    if (actorTelegramId === targetTelegramId) {
      return { success: false, error: 'أمان النظام: لا يمكنك حظر أو تجميد حسابك الشخصي.' };
    }

    const targetUser = await this.repository.getUserByTelegramId(targetTelegramId);
    if (!targetUser) {
      return { success: false, error: 'المستخدم المطلوب غير موجود.' };
    }

    if (targetUser.role === 'SUPER_ADMIN' && isBanned) {
      const activeSuperCount = await this.repository.countActiveSuperAdmins();
      if (activeSuperCount <= 1) {
        return {
          success: false,
          error: 'أمان الحوكمة: لا يمكن حظر المشرف العام الوحيد بالمنظومة.',
        };
      }
    }

    const updated = await this.repository.toggleUserBan(targetTelegramId, isBanned);
    return { success: true, user: updated };
  }

  async revokeUser(
    actorTelegramId: bigint,
    targetTelegramId: bigint
  ): Promise<{ success: boolean; error?: string }> {
    if (actorTelegramId === targetTelegramId) {
      return { success: false, error: 'أمان النظام: لا يمكنك سحب صلاحيات حسابك الشخصي.' };
    }

    const targetUser = await this.repository.getUserByTelegramId(targetTelegramId);
    if (!targetUser) {
      return { success: false, error: 'المستخدم المطلوب غير موجود.' };
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      const activeSuperCount = await this.repository.countActiveSuperAdmins();
      if (activeSuperCount <= 1) {
        return {
          success: false,
          error: 'أمان الحوكمة: لا يمكن سحب صلاحيات المشرف العام الوحيد بالمنظومة.',
        };
      }
    }

    await this.repository.revokeUser(targetTelegramId);
    return { success: true };
  }

  async previewTelegramProfile(
    telegramId: bigint,
    botApi?: { getChat: (chatId: number) => Promise<{ first_name?: string; last_name?: string; username?: string }> }
  ): Promise<LiveProfilePreview> {
    if (!botApi) {
      return { telegramId, exists: true };
    }

    try {
      const chat = await botApi.getChat(Number(telegramId));
      return {
        telegramId,
        exists: true,
        firstName: chat.first_name,
        lastName: chat.last_name,
        username: chat.username,
      };
    } catch {
      // If user has not started the bot or chat is inaccessible
      return {
        telegramId,
        exists: false,
        error: 'لم يتفاعل الحساب مع البوت بعد أو المعرف خاص/محمي.',
      };
    }
  }

  async directLinkWorker(
    workerId: string,
    rawTelegramId: string,
    options?: {
      confirmConflict?: boolean | undefined;
      telegramName?: string | undefined;
      botUsername?: string | undefined;
      officialPhone?: string | undefined;
    }
  ): Promise<DirectLinkResult> {
    const val = validateTelegramId(rawTelegramId);
    if (!val.isValid || !val.normalizedId) {
      return {
        success: false,
        workerCode: '',
        workerName: '',
        telegramId: 0n,
        error: val.error || 'معرف التليجرام غير صالح.',
      };
    }

    const res = await this.repository.atomicDirectLinkWorker(workerId, val.normalizedId, {
      confirmConflict: options?.confirmConflict,
      telegramName: options?.telegramName,
    });

    if (res.success && options?.officialPhone) {
      res.whatsAppUrl = buildWorkerWhatsAppLaunchUrl(
        res.workerName,
        options.officialPhone,
        options.botUsername
      );
    }

    return res;
  }

  async setPendingAction(actorId: bigint, action: PendingUserRbacAction) {
    return this.repository.setPendingAction(actorId, action);
  }

  async getPendingAction(actorId: bigint) {
    return this.repository.getPendingAction(actorId);
  }

  async clearPendingAction(actorId: bigint) {
    return this.repository.clearPendingAction(actorId);
  }
}
