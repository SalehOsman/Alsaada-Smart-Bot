import { Bot } from 'grammy';
import { prisma } from '../db.js';
import { MyContext } from '../types/context.js';

export interface DispatchKickTaskOptions {
  siteId: string;
  chatId: bigint | number;
  telegramId: bigint | number;
  topicId?: number | null;
  isPermanent?: boolean;
}

export class TelegramGroupEnforcerService {
  private bot: Bot<MyContext> | null = null;

  public setBot(bot: Bot<MyContext>): void {
    this.bot = bot;
  }

  /**
   * Ejects a user cleanly from a Telegram group without crashing if user is admin.
   * If not permanent, immediately unbans to allow re-entry via link later.
   */
  public async ejectMember(
    chatId: bigint | number,
    telegramId: bigint | number,
    isPermanent = false
  ): Promise<{ success: boolean; action: 'KICKED' | 'BANNED' | 'FAILED' | 'CANNOT_REMOVE_ADMIN'; error?: string }> {
    if (!this.bot) {
      return { success: false, action: 'FAILED', error: 'BOT_INSTANCE_NOT_BOUND' };
    }

    const numericChatId = Number(chatId);
    const numericUserId = Number(telegramId);

    try {
      // 1. Pre-flight member status check
      const member = await this.bot.api.getChatMember(numericChatId, numericUserId);
      if (member.status === 'creator' || member.status === 'administrator') {
        console.warn(`⚠️ [ENFORCER] Cannot eject admin/creator ${numericUserId} from group ${numericChatId}`);
        return { success: false, action: 'CANNOT_REMOVE_ADMIN', error: 'CANNOT_REMOVE_ADMIN' };
      }

      if (member.status === 'left' || member.status === 'kicked') {
        return { success: true, action: 'KICKED' };
      }

      // 2. Ban member
      await this.bot.api.banChatMember(numericChatId, numericUserId);

      // 3. If temporary kick (e.g. on leave / transfer), immediately unban so they can rejoin via invite
      if (!isPermanent) {
        await this.bot.api.unbanChatMember(numericChatId, numericUserId, { only_if_banned: true });
        return { success: true, action: 'KICKED' };
      }

      return { success: true, action: 'BANNED' };
    } catch (err: any) {
      console.error(`❌ [ENFORCER] Failed to eject member ${numericUserId} from ${numericChatId}:`, err.message);
      return { success: false, action: 'FAILED', error: err.message || 'UNKNOWN_ERROR' };
    }
  }

  /**
   * Creates a cryptographic single-use invite link requiring join request approval
   */
  public async createSingleUseJoinRequestInvite(
    chatId: bigint | number,
    siteName: string
  ): Promise<{ success: boolean; inviteLink?: string; error?: string }> {
    if (!this.bot) {
      return { success: false, error: 'BOT_INSTANCE_NOT_BOUND' };
    }

    try {
      const invite = await this.bot.api.createChatInviteLink(Number(chatId), {
        name: `دعوة مشرف - ${siteName}`.slice(0, 32),
        member_limit: 1,
        creates_join_request: true,
      });

      return { success: true, inviteLink: invite.invite_link };
    } catch (err: any) {
      console.error(`❌ [ENFORCER] Failed to create invite link for ${chatId}:`, err.message);
      return { success: false, error: err.message || 'FAILED_TO_CREATE_INVITE' };
    }
  }

  /**
   * Enqueues a background enforcement task into TelegramEnforcementTask table
   */
  public async dispatchKickTask(options: DispatchKickTaskOptions): Promise<string> {
    const task = await prisma.telegramEnforcementTask.create({
      data: {
        siteId: options.siteId,
        telegramId: BigInt(options.telegramId),
        chatId: BigInt(options.chatId),
        topicId: options.topicId || null,
        taskType: options.isPermanent ? 'BAN_MEMBER' : 'KICK_MEMBER',
        status: 'PENDING',
      },
    });

    // Fire and forget immediate attempt
    this.processSingleTask(task.id).catch((err) => {
      console.warn(`[ENFORCER QUEUE] Immediate task execution failed, will retry in background:`, err.message);
    });

    return task.id;
  }

  /**
   * Processes a single task from the database queue with exponential retry backoff
   */
  public async processSingleTask(taskId: string): Promise<boolean> {
    const task = await prisma.telegramEnforcementTask.findUnique({ where: { id: taskId } });
    if (!task || task.status === 'COMPLETED') return true;

    try {
      await prisma.telegramEnforcementTask.update({
        where: { id: taskId },
        data: { status: 'PROCESSING' },
      });

      const isPermanent = task.taskType === 'BAN_MEMBER';
      const result = await this.ejectMember(task.chatId, task.telegramId, isPermanent);

      if (result.success || result.action === 'CANNOT_REMOVE_ADMIN') {
        await prisma.telegramEnforcementTask.update({
          where: { id: taskId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            lastError: result.error || null,
          },
        });
        return true;
      }

      // Retry backoff
      const newRetryCount = task.retryCount + 1;
      if (newRetryCount >= task.maxRetries) {
        await prisma.telegramEnforcementTask.update({
          where: { id: taskId },
          data: {
            status: 'FAILED',
            retryCount: newRetryCount,
            lastError: result.error || 'MAX_RETRIES_EXCEEDED',
          },
        });
        return false;
      }

      const backoffSeconds = Math.pow(2, newRetryCount) * 10;
      const nextExecution = new Date(Date.now() + backoffSeconds * 1000);

      await prisma.telegramEnforcementTask.update({
        where: { id: taskId },
        data: {
          status: 'PENDING',
          retryCount: newRetryCount,
          executeAt: nextExecution,
          lastError: result.error || 'RETRYING',
        },
      });
      return false;
    } catch (err: any) {
      await prisma.telegramEnforcementTask.update({
        where: { id: taskId },
        data: {
          status: 'PENDING',
          retryCount: task.retryCount + 1,
          lastError: err.message || 'UNEXPECTED_ERROR',
        },
      });
      return false;
    }
  }

  /**
   * Auto-healing listener for group migration to Supergroup (message:migrate_to_chat_id)
   */
  public async handleGroupMigration(oldChatId: bigint | number, newChatId: bigint | number): Promise<void> {
    const oldBigInt = BigInt(oldChatId);
    const newBigInt = BigInt(newChatId);

    console.log(`🔄 [ENFORCER] Group migrated from ${oldBigInt} to ${newBigInt}. Updating site records...`);

    const updated = await prisma.site.updateMany({
      where: { telegramGroupId: oldBigInt },
      data: { telegramGroupId: newBigInt },
    });

    console.log(`✅ [ENFORCER] Successfully updated ${updated.count} site(s) with new supergroup ID.`);
  }
}

export const telegramGroupEnforcer = new TelegramGroupEnforcerService();
