import type { Api } from 'grammy';
import type { TelegramGroupsRepository } from './flow.repository.js';
import type { GroupHealthStatusDto, HqGroupStatusDto, SiteGroupItemDto } from './flow.types.js';

export class TelegramGroupsService {
  constructor(private readonly repo: TelegramGroupsRepository) {}

  async getHqGroupStatus(): Promise<HqGroupStatusDto> {
    return this.repo.getHqGroupStatus();
  }

  async bindHqGroup(chatId: string): Promise<void> {
    const cleanId = chatId.trim();
    if (!/^-?\d+$/.test(cleanId)) {
      throw new Error('معرف الجروب يجب أن يكون رقماً صحيحاً (مثل -1001234567890)');
    }
    await this.repo.setHqGroupId(cleanId);
  }

  async unbindHqGroup(): Promise<void> {
    await this.repo.deleteHqGroup();
  }

  async createHqTopics(
    api: Api,
    chatId: string
  ): Promise<{
    siteClosuresThreadId: number;
    financialDigestsThreadId: number;
    logisticsFuelThreadId: number;
    executiveDecreesThreadId: number;
  }> {
    const chatNum = Number(chatId);

    // Create the 4 core topics in sequential order
    const t1 = await api.createForumTopic(chatNum, '📊 الإقفالات اليومية للمواقع');
    const t2 = await api.createForumTopic(chatNum, '💰 ملخصات الرواتب والسلف والعهد');
    const t3 = await api.createForumTopic(chatNum, '🚚 تقارير إنتاج وشحن الفوسفات والمحروقات');
    const t4 = await api.createForumTopic(chatNum, '📢 التوجيهات والقرارات السيادية');

    const topicsConfig = {
      siteClosuresThreadId: t1.message_thread_id,
      financialDigestsThreadId: t2.message_thread_id,
      logisticsFuelThreadId: t3.message_thread_id,
      executiveDecreesThreadId: t4.message_thread_id,
    };

    await this.repo.saveHqTopics(topicsConfig);
    return topicsConfig;
  }

  async diagnoseGroup(api: Api, botId: number, chatId: string): Promise<GroupHealthStatusDto> {
    try {
      const chatNum = Number(chatId);
      const [chat, member] = await Promise.all([
        api.getChat(chatNum),
        api.getChatMember(chatNum, botId),
      ]);

      const title = 'title' in chat ? chat.title : undefined;
      const isForum = 'is_forum' in chat ? Boolean(chat.is_forum) : false;
      const isAdmin = member.status === 'administrator' || member.status === 'creator';

      const memberRecord = member as unknown as Record<string, unknown>;
      const canPostMessages = isAdmin
        ? member.status === 'creator' || Boolean(memberRecord.can_post_messages ?? memberRecord.can_send_messages ?? true)
        : false;

      const canManageTopics = isAdmin
        ? member.status === 'creator' || Boolean(memberRecord.can_manage_topics)
        : false;

      const canDeleteMessages = isAdmin
        ? member.status === 'creator' || Boolean(memberRecord.can_delete_messages)
        : false;

      let statusMessage = '🟢 الاتصال سليم وصلاحيات البوت مفعلة.';
      if (!isAdmin) {
        statusMessage = '⚠️ البوت ليس مشرفاً (Admin) في هذه المجموعة.';
      } else if (isForum && !canManageTopics) {
        statusMessage = '⚠️ البوت مشرف ولكن تنقصه صلاحية إدارة المواضيع (Manage Topics).';
      }

      return {
        isAvailable: true,
        chatId,
        title,
        type: chat.type,
        isForum,
        canPostMessages,
        canManageTopics,
        canDeleteMessages,
        statusMessage,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'خطأ غير متوقع';
      return {
        isAvailable: false,
        chatId,
        canPostMessages: false,
        canManageTopics: false,
        canDeleteMessages: false,
        statusMessage: `🔴 تعذر الوصول للمجموعة: ${errMsg}`,
      };
    }
  }

  async listSites(): Promise<SiteGroupItemDto[]> {
    return this.repo.listSites();
  }

  async getSite(siteId: string): Promise<SiteGroupItemDto | null> {
    return this.repo.getSiteById(siteId);
  }

  async bindSiteGroup(siteId: string, chatId: string): Promise<void> {
    const cleanId = chatId.trim();
    if (!/^-?\d+$/.test(cleanId)) {
      throw new Error('معرف الجروب يجب أن يكون رقماً صحيحاً (مثل -1001234567890)');
    }
    await this.repo.updateSiteTelegramGroupId(siteId, cleanId);
  }

  async unbindSiteGroup(siteId: string): Promise<void> {
    await this.repo.updateSiteTelegramGroupId(siteId, null);
  }

  buildAddBotUrl(botUsername: string, mode: 'hq' | 'site', siteCode?: string): string {
    const cleanUsername = botUsername.replace(/^@/, '');
    if (mode === 'hq') {
      return `https://t.me/${cleanUsername}?startgroup=bind_hq&admin=post_messages+manage_topics+delete_messages`;
    }
    return `https://t.me/${cleanUsername}?startgroup=bind_site_${siteCode || 'site'}&admin=post_messages`;
  }
}
