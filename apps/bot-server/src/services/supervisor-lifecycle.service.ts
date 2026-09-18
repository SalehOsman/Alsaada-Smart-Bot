import { prisma } from '../db.js';
import { telegramGroupEnforcer, TelegramGroupEnforcerService } from './telegram-group-enforcer.service.js';
import { invalidateUserCache } from '../middlewares/auth.middleware.js';

export interface SiteTransferParams {
  userId: string;
  targetSiteId: string;
  actorTelegramId: bigint | number;
  notes?: string;
}

export interface LeaveStartParams {
  userId: string;
  actorTelegramId: bigint | number;
  notes?: string;
}

export interface LeaveReturnParams {
  userId: string;
  actorTelegramId: bigint | number;
  notes?: string;
}

export interface TerminationParams {
  userId: string;
  actorTelegramId: bigint | number;
  reason?: string;
}

export class SupervisorLifecycleService {
  private enforcer: TelegramGroupEnforcerService;

  constructor(enforcer: TelegramGroupEnforcerService = telegramGroupEnforcer) {
    this.enforcer = enforcer;
  }

  /**
   * Transfers a supervisor to a new site atomically.
   * Ejects from old site group and generates invite link for new site group.
   */
  public async transferSite(params: SiteTransferParams): Promise<{
    success: boolean;
    previousSiteName?: string | undefined;
    newSiteName?: string | undefined;
    inviteLink?: string | undefined;
    error?: string | undefined;
  }> {
    const { userId, targetSiteId, actorTelegramId, notes } = params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { assignedSite: true },
    });

    if (!user) {
      return { success: false, error: 'USER_NOT_FOUND' };
    }

    const targetSite = await prisma.site.findUnique({ where: { id: targetSiteId } });
    if (!targetSite) {
      return { success: false, error: 'TARGET_SITE_NOT_FOUND' };
    }

    const previousSiteId = user.assignedSiteId;
    const oldChatId = user.assignedSite?.telegramGroupId;

    return await prisma.$transaction(async (tx) => {
      // 1. Update user assigned site
      await tx.user.update({
        where: { id: userId },
        data: { assignedSiteId: targetSiteId },
      });

      // 2. Dispatch kick from old group if existed
      let telegramAction = 'SKIPPED';
      if (oldChatId) {
        await this.enforcer.dispatchKickTask({
          siteId: previousSiteId || '',
          chatId: oldChatId,
          telegramId: user.telegramId,
          topicId: user.assignedSite?.telegramTopicId ?? null,
          isPermanent: false,
        });
        telegramAction = 'KICKED';
      }

      // 3. Generate invite for new site group if existed
      let inviteLink: string | undefined;
      if (targetSite.telegramGroupId) {
        const inviteRes = await this.enforcer.createSingleUseJoinRequestInvite(
          targetSite.telegramGroupId,
          targetSite.name
        );
        if (inviteRes.success) {
          inviteLink = inviteRes.inviteLink;
        }
      }

      // 4. Log lifecycle change
      await tx.supervisorLifecycleLog.create({
        data: {
          userId,
          workerId: user.workerId,
          actionType: 'SITE_TRANSFER',
          previousSiteId: previousSiteId || null,
          newSiteId: targetSiteId,
          telegramGroupId: targetSite.telegramGroupId || null,
          telegramTopicId: targetSite.telegramTopicId || null,
          telegramAction,
          notes: notes || `نقل المشرف إلى موقع ${targetSite.name}`,
          actorTelegramId: BigInt(actorTelegramId),
        },
      });

      // Invalidate auth cache
      await invalidateUserCache(user.telegramId);

      return {
        success: true,
        previousSiteName: user.assignedSite?.name,
        newSiteName: targetSite.name,
        inviteLink,
      };
    });
  }

  /**
   * Initiates supervisor leave according to their individual leave policies.
   */
  public async startLeave(params: LeaveStartParams): Promise<{
    success: boolean;
    botAccessFrozen: boolean;
    telegramEjected: boolean;
    error?: string;
  }> {
    const { userId, actorTelegramId, notes } = params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { assignedSite: true },
    });

    if (!user) {
      return { success: false, botAccessFrozen: false, telegramEjected: false, error: 'USER_NOT_FOUND' };
    }

    return await prisma.$transaction(async (tx) => {
      let botAccessFrozen = false;
      let telegramEjected = false;

      // 1. Bot Access Policy Check
      if (user.freezeBotAccessOnLeave) {
        await tx.user.update({
          where: { id: userId },
          data: { role: 'WORKER' },
        });
        botAccessFrozen = true;
      }

      // 2. Telegram Group Ejection Policy Check
      const site = user.assignedSite;
      let telegramAction = 'SKIPPED_POLICY';

      if (user.ejectTelegramOnLeave && site?.telegramGroupId) {
        await this.enforcer.dispatchKickTask({
          siteId: site.id,
          chatId: site.telegramGroupId,
          telegramId: user.telegramId,
          topicId: site.telegramTopicId,
          isPermanent: false,
        });
        telegramAction = 'KICKED';
        telegramEjected = true;
      }

      // 3. Record Audit Log
      await tx.supervisorLifecycleLog.create({
        data: {
          userId,
          workerId: user.workerId,
          actionType: 'LEAVE_START',
          previousSiteId: user.assignedSiteId || null,
          telegramGroupId: site?.telegramGroupId || null,
          telegramTopicId: site?.telegramTopicId || null,
          telegramAction,
          notes: notes || (telegramEjected ? 'بدء إجازة واستبعاد من الجروب' : 'بدء إجازة والإبقاء في الجروب بموجب السياسة'),
          actorTelegramId: BigInt(actorTelegramId),
        },
      });

      await invalidateUserCache(user.telegramId);

      return {
        success: true,
        botAccessFrozen,
        telegramEjected,
      };
    });
  }

  /**
   * Returns a supervisor from leave and restores supervisor privileges.
   */
  public async returnFromLeave(params: LeaveReturnParams): Promise<{
    success: boolean;
    inviteLink?: string | undefined;
    error?: string | undefined;
  }> {
    const { userId, actorTelegramId, notes } = params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { assignedSite: true },
    });

    if (!user) {
      return { success: false, error: 'USER_NOT_FOUND' };
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Restore role to FIELD_ADMIN
      await tx.user.update({
        where: { id: userId },
        data: { role: 'FIELD_ADMIN' },
      });

      // 2. Generate invite link if was ejected and site has group
      let inviteLink: string | undefined;
      const site = user.assignedSite;

      if (site?.telegramGroupId) {
        const inviteRes = await this.enforcer.createSingleUseJoinRequestInvite(
          site.telegramGroupId,
          site.name
        );
        if (inviteRes.success) {
          inviteLink = inviteRes.inviteLink;
        }
      }

      // 3. Log return
      await tx.supervisorLifecycleLog.create({
        data: {
          userId,
          workerId: user.workerId,
          actionType: 'LEAVE_RETURN',
          newSiteId: user.assignedSiteId || null,
          telegramGroupId: site?.telegramGroupId || null,
          telegramTopicId: site?.telegramTopicId || null,
          telegramAction: inviteLink ? 'INVITE_SENT' : 'RESTORED',
          notes: notes || 'عودة من الإجازة واستعادة الصلاحيات الإشرافية',
          actorTelegramId: BigInt(actorTelegramId),
        },
      });

      await invalidateUserCache(user.telegramId);

      return {
        success: true,
        inviteLink,
      };
    });
  }

  /**
   * Terminates a supervisor: deactivates user and permanently bans from site group.
   */
  public async terminate(params: TerminationParams): Promise<{
    success: boolean;
    error?: string;
  }> {
    const { userId, actorTelegramId, reason } = params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { assignedSite: true },
    });

    if (!user) {
      return { success: false, error: 'USER_NOT_FOUND' };
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Deactivate account
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false, isBanned: true },
      });

      // 2. Permanently ban from site group
      const site = user.assignedSite;
      if (site?.telegramGroupId) {
        await this.enforcer.dispatchKickTask({
          siteId: site.id,
          chatId: site.telegramGroupId,
          telegramId: user.telegramId,
          topicId: site.telegramTopicId,
          isPermanent: true,
        });
      }

      // 3. Log termination
      await tx.supervisorLifecycleLog.create({
        data: {
          userId,
          workerId: user.workerId,
          actionType: 'TERMINATION',
          previousSiteId: user.assignedSiteId || null,
          telegramGroupId: site?.telegramGroupId || null,
          telegramTopicId: site?.telegramTopicId || null,
          telegramAction: 'BANNED',
          notes: reason || 'إنهاء الخدمة والحظر الدائم من مجموعات العمل',
          actorTelegramId: BigInt(actorTelegramId),
        },
      });

      await invalidateUserCache(user.telegramId);

      return { success: true };
    });
  }
}

export const supervisorLifecycleService = new SupervisorLifecycleService();
