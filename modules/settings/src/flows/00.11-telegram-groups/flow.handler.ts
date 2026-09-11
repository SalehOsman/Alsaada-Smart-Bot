import { InlineKeyboard } from 'grammy';
import { showModalAlert } from '@alsaada/core-components';
import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { TelegramGroupsService } from './flow.service.js';
import type { TelegramGroupsRepository } from './flow.repository.js';
import {
  buildGroupsHubKeyboard,
  buildHqDetailKeyboard,
  buildSitesMatrixKeyboard,
  buildSiteDetailKeyboard,
} from './flow.keyboard.js';
import {
  formatGroupsHubMessage,
  formatHqDetailMessage,
  formatSitesMatrixMessage,
  formatSiteDetailMessage,
  formatGroupHealthMessage,
} from './flow.messages.js';

export class TelegramGroupsHandler {
  constructor(
    private readonly service: TelegramGroupsService,
    private readonly repo: TelegramGroupsRepository
  ) {}

  private isSuperAdmin(ctx: SettingsModuleContext): boolean {
    return Boolean(
      ctx.isRealSuperAdmin &&
      ctx.effectiveRole === 'SUPER_ADMIN' &&
      !ctx.isImpersonating
    );
  }

  async renderGroupsHub(ctx: SettingsModuleContext, inPlace = false): Promise<void> {
    if (!this.isSuperAdmin(ctx)) {
      await showModalAlert(ctx, '🔒 هذا القسم مخصص حصرياً للمدير العام.');
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.from) await this.repo.clearPendingInput(BigInt(ctx.from.id));

    const [hqStatus, sites] = await Promise.all([
      this.service.getHqGroupStatus(),
      this.service.listSites(),
    ]);

    const text = formatGroupsHubMessage(hqStatus, sites);
    const keyboard = buildGroupsHubKeyboard(hqStatus);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {
        // fallback
      }
    }

    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async renderHqDetail(ctx: SettingsModuleContext, inPlace = false): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.from) await this.repo.clearPendingInput(BigInt(ctx.from.id));

    const hqStatus = await this.service.getHqGroupStatus();
    const botUsername = ctx.me?.username || 'AlsaadaBot';
    const addUrl = this.service.buildAddBotUrl(botUsername, 'hq');

    const text = formatHqDetailMessage(hqStatus);
    const keyboard = buildHqDetailKeyboard({
      isBound: hqStatus.isBound,
      addUrl,
    });

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {
        // fallback
      }
    }

    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handlePromptEditHqChatId(ctx: SettingsModuleContext): Promise<void> {
    if (!this.isSuperAdmin(ctx) || !ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    await this.repo.setPendingInput(BigInt(ctx.from.id), { type: 'hq' });

    const keyboard = new InlineKeyboard().text('❌ إلغاء والتراجع', 'grp:hq');
    const prompt =
      `✏️ *إدخال معرف جروب الإدارة العليا*\n\n` +
      `أرسل الآن المعرف الرقمي للمجموعة في رسالة (Chat ID).\n` +
      `📌 *ملاحظة:* معرفات المجموعات تبدأ عادة بإشارة سالب (مثال: \`-1002345678901\`).`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(prompt, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(prompt, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  }

  async handleCreateHqTopics(ctx: SettingsModuleContext): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    const hqStatus = await this.service.getHqGroupStatus();
    if (!hqStatus.isBound || !hqStatus.chatId) {
      await showModalAlert(ctx, '⚠️ يجب أولاً ربط وتحديد معرف جروب الإدارة العليا.');
      return;
    }

    try {
      await this.service.createHqTopics(ctx.api, hqStatus.chatId);
      await showModalAlert(ctx, '✅ تم إنشاء وتكويد التوبيكات الأربعة لجروب الإدارة العليا بنجاح.');
      await this.renderHqDetail(ctx, true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await showModalAlert(
        ctx,
        `❌ فشل إنشاء التوبيكات: تأكد من ترقية البوت لمشرف وتفعيل خاصية Topics في الجروب.\n(${errMsg})`
      );
    }
  }

  async handleDiagnoseHqGroup(ctx: SettingsModuleContext): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    const hqStatus = await this.service.getHqGroupStatus();
    if (!hqStatus.isBound || !hqStatus.chatId) {
      await showModalAlert(ctx, '⚠️ لا يوجد جروب مربوط للإدارة العليا لفحصه.');
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const botId = ctx.me?.id ?? 0;
    const health = await this.service.diagnoseGroup(ctx.api, botId, hqStatus.chatId);
    const text = formatGroupHealthMessage(health);

    const keyboard = new InlineKeyboard()
      .text('🔄 إعادة الفحص', 'grp:hq:test')
      .row()
      .text('🔙 العودة لإدارة جروب الإدارة', 'grp:hq');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  }

  async handleUnbindHqGroup(ctx: SettingsModuleContext): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    await this.service.unbindHqGroup();
    await showModalAlert(ctx, '🗑️ تم إلغاء ربط جروب الإدارة العليا وحذف إعدادات التوبيكات.');
    await this.renderHqDetail(ctx, true);
  }

  async renderSitesMatrix(ctx: SettingsModuleContext, inPlace = false): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.from) await this.repo.clearPendingInput(BigInt(ctx.from.id));

    const sites = await this.service.listSites();
    const text = formatSitesMatrixMessage(sites);
    const keyboard = buildSitesMatrixKeyboard(sites);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {
        // fallback
      }
    }

    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async renderSiteDetail(
    ctx: SettingsModuleContext,
    siteId: string,
    inPlace = false
  ): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.from) await this.repo.clearPendingInput(BigInt(ctx.from.id));

    const site = await this.service.getSite(siteId);
    if (!site) {
      await showModalAlert(ctx, '❌ الموقع المطلوب غير مسجل.');
      await this.renderSitesMatrix(ctx, inPlace);
      return;
    }

    const botUsername = ctx.me?.username || 'AlsaadaBot';
    const addUrl = this.service.buildAddBotUrl(botUsername, 'site', site.code);

    const text = formatSiteDetailMessage(site);
    const keyboard = buildSiteDetailKeyboard(site, addUrl);

    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      } catch {
        // fallback
      }
    }

    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handlePromptEditSiteChatId(
    ctx: SettingsModuleContext,
    siteId: string
  ): Promise<void> {
    if (!this.isSuperAdmin(ctx) || !ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const site = await this.service.getSite(siteId);
    if (!site) return;

    await this.repo.setPendingInput(BigInt(ctx.from.id), { type: 'site', siteId });

    const keyboard = new InlineKeyboard().text('❌ إلغاء والتراجع', `grp:s:v:${site.id}`);
    const prompt =
      `✏️ *ربط مجموعة موقع: ${site.name}*\n\n` +
      `أرسل الآن المعرف الرقمي للمجموعة في رسالة (Chat ID).\n` +
      `📌 *ملاحظة:* معرفات المجموعات تبدأ عادة بإشارة سالب (مثال: \`-1002345678901\`).`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(prompt, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(prompt, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  }

  async handleDiagnoseSiteGroup(
    ctx: SettingsModuleContext,
    siteId: string
  ): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    const site = await this.service.getSite(siteId);
    if (!site || !site.isBound || !site.telegramGroupId) {
      await showModalAlert(ctx, '⚠️ لا يوجد جروب مربوط لهذا الموقع لفحصه.');
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const botId = ctx.me?.id ?? 0;
    const health = await this.service.diagnoseGroup(ctx.api, botId, site.telegramGroupId);
    const text = formatGroupHealthMessage(health);

    const keyboard = new InlineKeyboard()
      .text('🔄 إعادة الفحص', `grp:s:t:${site.id}`)
      .row()
      .text('🔙 العودة لبيانات الموقع', `grp:s:v:${site.id}`);

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  }

  async handleUnbindSiteGroup(
    ctx: SettingsModuleContext,
    siteId: string
  ): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    await this.service.unbindSiteGroup(siteId);
    await showModalAlert(ctx, '🗑️ تم إلغاء ربط جروب الموقع بنجاح.');
    await this.renderSiteDetail(ctx, siteId, true);
  }

  async handleTextInput(ctx: SettingsModuleContext): Promise<boolean> {
    if (!ctx.from || !ctx.message?.text) return false;
    const telegramId = BigInt(ctx.from.id);

    const pending = await this.repo.getPendingInput(telegramId);
    if (!pending) return false;

    const inputVal = ctx.message.text.trim();
    await ctx.deleteMessage().catch(() => {});

    if (!/^-?\d+$/.test(inputVal)) {
      await ctx.reply(
        '❌ *معرف غير صالح:* يجب أن يتكون معرف المحادثة من أرقام فقط (مثال: `-1001234567890`). يرجى المحاولة مرة أخرى أو الضغط على زر الإلغاء.'
      );
      return true;
    }

    await this.repo.clearPendingInput(telegramId);

    if (pending.type === 'hq') {
      await this.service.bindHqGroup(inputVal);
      await ctx.reply('✅ تم ربط جروب الإدارة العليا بنجاح.');
      await this.renderHqDetail(ctx, false);
      return true;
    }

    if (pending.type === 'site') {
      await this.service.bindSiteGroup(pending.siteId, inputVal);
      await ctx.reply('✅ تم ربط جروب الموقع الميداني بنجاح.');
      await this.renderSiteDetail(ctx, pending.siteId, false);
      return true;
    }

    return false;
  }
}
