import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { SitesHubService } from './flow.service.js';
import type { SiteFieldKey } from './flow.types.js';
import {
  buildSitesListKeyboard,
  buildSiteDetailKeyboard,
  buildSiteEditMenuKeyboard,
  buildGeofencePickerKeyboard,
  buildGovPickerKeyboard,
  buildProjectsPickerKeyboard,
} from './flow.keyboard.js';
import {
  formatSitesListCard,
  formatSiteDetailCard,
  formatAddSiteNamePrompt,
  formatConfirmCodePrompt,
  formatSelectGovPrompt,
  formatSelectGeofencePrompt,
} from './flow.messages.js';

export class SitesHubHandler {
  constructor(private readonly service: SitesHubService) {}

  async renderSitesHub(ctx: SettingsModuleContext, inPlace = false, noticeText?: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '🔒 هذا القسم مخصص حصرياً للمدير العام.', show_alert: true }).catch(() => {});
      } else {
        await ctx.reply('🔒 هذا القسم مخصص حصرياً للمدير العام.');
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.from) {
      await this.service.clearWizardState(BigInt(ctx.from.id));
      await this.service.clearEditState(BigInt(ctx.from.id));
    }

    const sites = await this.service.listSites();
    const keyboard = buildSitesListKeyboard(sites, ctx.isImpersonating);
    const text = formatSitesListCard(sites, noticeText);

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

  async renderSiteDetail(ctx: SettingsModuleContext, code: string, inPlace = false, noticeText?: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const site = await this.service.getSiteByCode(code);
    if (!site) {
      await this.renderSitesHub(ctx, inPlace, '❌ الموقع المطلوب غير موجود.');
      return;
    }

    const keyboard = buildSiteDetailKeyboard(site, ctx.isImpersonating);
    const text = formatSiteDetailCard(site, noticeText);

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

  async handleToggleSite(ctx: SettingsModuleContext, code: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    const updated = await this.service.toggleSiteStatus(code);
    const notice = updated.status === 'ACTIVE' ? `تم إعادة تنشيط موقع (${updated.name}) بنجاح.` : `تم إيقاف موقع (${updated.name}) مؤقتاً.`;
    await this.renderSiteDetail(ctx, code, true, notice);
  }

  async handleStartAddSite(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (!ctx.from || !ctx.callbackQuery) return;
    await ctx.answerCallbackQuery().catch(() => {});

    const promptMessageId = ctx.callbackQuery.message?.message_id || 0;
    await this.service.setWizardState(BigInt(ctx.from.id), {
      step: 'AWAIT_NAME',
      promptMessageId,
      timestamp: Date.now(),
    });

    const text = formatAddSiteNamePrompt();
    await ctx.editMessageText(text, { parse_mode: 'Markdown' }).catch(() => ctx.reply(text, { parse_mode: 'Markdown' }));
  }

  async handleConfirmCode(ctx: SettingsModuleContext, confirmedCode: string): Promise<void> {
    if (!ctx.from) return;
    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state || !state.name) return;

    state.code = confirmedCode;
    state.step = 'SELECT_GOV';
    await this.service.setWizardState(BigInt(ctx.from.id), state);

    const keyboard = buildGovPickerKeyboard();
    const text = formatSelectGovPrompt(state.name);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }).catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard }));
  }

  async handleSelectGov(ctx: SettingsModuleContext, gov: string, siteCode?: string): Promise<void> {
    if (!ctx.from) return;
    if (siteCode) {
      await this.service.updateField(siteCode, 'gov', gov);
      await this.renderSiteDetail(ctx, siteCode, true, `تم تحديث المحافظة إلى: ${gov}`);
      return;
    }

    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state || !state.name) return;

    state.gov = gov;
    state.step = 'SELECT_GEOFENCE';
    await this.service.setWizardState(BigInt(ctx.from.id), state);

    const keyboard = buildGeofencePickerKeyboard();
    const text = formatSelectGeofencePrompt(state.name);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }).catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard }));
  }

  async handleSelectGeofence(ctx: SettingsModuleContext, radius: number, siteCode?: string): Promise<void> {
    if (!ctx.from) return;
    if (siteCode) {
      await this.service.updateField(siteCode, 'geofence', radius);
      await this.renderSiteDetail(ctx, siteCode, true, `تم تحديث نطاق السياج إلى: ${radius} متر`);
      return;
    }

    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state || !state.name || !state.code) return;

    const res = await this.service.createSite({
      name: state.name,
      code: state.code,
      ...(state.gov ? { governorate: state.gov } : {}),
      geofenceRadiusMeters: radius,
    });


    await this.service.clearWizardState(BigInt(ctx.from.id));

    if (!res.success || !res.site) {
      await this.renderSitesHub(ctx, true, `❌ فشل إنشاء الموقع: ${res.error}`);
      return;
    }

    await this.renderSiteDetail(ctx, res.site.code, true, `✅ تم تسجيل وإنشاء موقع [${res.site.name}] بنجاح!`);
  }

  async handleEditMenu(ctx: SettingsModuleContext, siteCode: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const keyboard = buildSiteEditMenuKeyboard(siteCode);
    const text = `⚙️ *خيارات تعديل بيانات الموقع:* \`${siteCode}\`\nاختر الحقل المراد تعديله:`;
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }).catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard }));
  }

  async handleStartEditField(ctx: SettingsModuleContext, fieldKey: SiteFieldKey, siteCode: string): Promise<void> {
    if (!ctx.from || !ctx.callbackQuery) return;
    await ctx.answerCallbackQuery().catch(() => {});

    if (fieldKey === 'gov') {
      const keyboard = buildGovPickerKeyboard(siteCode);
      await ctx.editMessageText('اختر المحافظة الجديدة:', { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    }
    if (fieldKey === 'geofence') {
      const keyboard = buildGeofencePickerKeyboard(siteCode);
      await ctx.editMessageText('اختر نصف قطر السياج الجغرافي الجديد:', { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    }
    if (fieldKey === 'project') {
      const projects = await this.service.listProjects();
      const keyboard = buildProjectsPickerKeyboard(projects, siteCode);
      await ctx.editMessageText('اختر المشروع التابع له الموقع:', { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    }

    const messageId = ctx.callbackQuery.message?.message_id || 0;
    await this.service.setEditState(BigInt(ctx.from.id), {
      siteCode,
      fieldKey,
      promptMessageId: messageId,
      timestamp: Date.now(),
    });

    await ctx.editMessageText(`أرسل القيمة الجديدة لحقل [${fieldKey}] الآن في رسالة:`, { parse_mode: 'Markdown' });
  }

  async handleTextInput(ctx: SettingsModuleContext): Promise<boolean> {
    if (!ctx.from || !ctx.message?.text) return false;
    const telegramId = BigInt(ctx.from.id);

    const wizard = await this.service.getWizardState(telegramId);
    if (wizard && wizard.step === 'AWAIT_NAME') {
      const siteName = ctx.message.text.trim();
      wizard.name = siteName;
      const suggestedCode = await this.service.getNextSuggestedCode();
      wizard.code = suggestedCode;
      wizard.step = 'CONFIRM_CODE';
      await this.service.setWizardState(telegramId, wizard);

      await ctx.deleteMessage().catch(() => {});
      const keyboard = new (await import('grammy')).InlineKeyboard()
        .text(`✅ اعتماد الكود المقترح (${suggestedCode})`, `action:site:confirm_code:${suggestedCode}`)
        .row()
        .text('❌ إلغاء', 'action:settings:sites_hub');

      const text = formatConfirmCodePrompt(siteName, suggestedCode);
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      return true;
    }

    const editState = await this.service.getEditState(telegramId);
    if (editState) {
      const textVal = ctx.message.text.trim();
      await ctx.deleteMessage().catch(() => {});
      await this.service.clearEditState(telegramId);

      const res = await this.service.updateField(editState.siteCode, editState.fieldKey, textVal);
      if (!res.success) {
        await ctx.reply(`❌ فشل التحديث: ${res.error}`);
        return true;
      }
      await this.renderSiteDetail(ctx, editState.siteCode, false, `تم تحديث [${editState.fieldKey}] بنجاح.`);
      return true;
    }

    return false;
  }

  async handleSelectProject(ctx: SettingsModuleContext, projectId: string, siteCode?: string): Promise<void> {
    if (!ctx.from) return;
    if (siteCode) {
      await this.service.updateField(siteCode, 'project', projectId);
      await this.renderSiteDetail(ctx, siteCode, true, 'تم ربط الموقع بالمشروع بنجاح.');
      return;
    }

    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state) return;

    state.projectId = projectId;
    await this.service.setWizardState(BigInt(ctx.from.id), state);
  }

  async handleLocationInput(ctx: SettingsModuleContext): Promise<boolean> {
    if (!ctx.from || !ctx.message?.location) return false;
    const telegramId = BigInt(ctx.from.id);
    const editState = await this.service.getEditState(telegramId);
    if (editState && editState.fieldKey === 'location') {
      const { latitude, longitude } = ctx.message.location;
      await this.service.clearEditState(telegramId);
      await this.service.updateField(editState.siteCode, 'location', `${latitude},${longitude}`);
      await ctx.deleteMessage().catch(() => {});
      await this.renderSiteDetail(ctx, editState.siteCode, false, `📍 تم تحديث الموقع الجغرافي بنجاح: (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
      return true;
    }
    return false;
  }
}

