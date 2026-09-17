import {
  InPlaceFlowManager,
  buildCompletionKeyboard,
  parseTelegramLocation,
} from '@alsaada/core-components';
import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { SitesHubService } from './flow.service.js';
import type { SiteFieldKey } from './flow.types.js';
import {
  buildSitesListKeyboard,
  buildSiteDetailKeyboard,
  buildSiteEditMenuKeyboard,
  buildGeofencePickerKeyboard,
  buildGovPickerKeyboard,
  buildSiteLocationPromptKeyboard,
  buildProjectsPickerKeyboard,
  buildConfirmCodeKeyboard,
} from './flow.keyboard.js';
import {
  formatSitesListCard,
  formatSiteDetailCard,
  formatAddSiteNamePrompt,
  formatConfirmCodePrompt,
  formatSelectGovPrompt,
  formatSiteLocationPrompt,
  formatSelectGeofencePrompt,
  formatSiteCreationSuccessCard,
} from './flow.messages.js';

export class SitesHubHandler {
  constructor(private readonly service: SitesHubService) {}

  private isAuthorized(ctx: SettingsModuleContext): boolean {
    return Boolean(ctx.isRealSuperAdmin || ctx.effectiveRole === 'SUPER_ADMIN');
  }

  async renderSitesHub(ctx: SettingsModuleContext, inPlaceOrMsgId?: boolean | number, noticeText?: string): Promise<void> {
    if (!this.isAuthorized(ctx)) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: '🔒 هذا القسم مخصص حصرياً للمدير العام.', show_alert: true }).catch(() => {});
      else await ctx.reply('🔒 هذا القسم مخصص حصرياً للمدير العام.');
      return;
    }
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const editState = ctx.from ? await this.service.getEditState?.(BigInt(ctx.from.id)) : null;
    const wizardState = ctx.from ? await this.service.getWizardState?.(BigInt(ctx.from.id)) : null;
    if (ctx.from) {
      await this.service.clearWizardState?.(BigInt(ctx.from.id));
      await this.service.clearEditState?.(BigInt(ctx.from.id));
    }
    const sites = await this.service.listSites();
    const keyboard = buildSitesListKeyboard(sites, ctx.isImpersonating);
    const text = formatSitesListCard(sites, noticeText);
    const activeMessageId = typeof inPlaceOrMsgId === 'number' && inPlaceOrMsgId > 0 ? inPlaceOrMsgId : editState?.promptMessageId ?? wizardState?.promptMessageId ?? ctx.callbackQuery?.message?.message_id;
    await InPlaceFlowManager.renderStep(ctx, { prompt: text, keyboard, activeMessageId, flowType: 'sites_hub' });
  }

  async renderSiteDetail(ctx: SettingsModuleContext, code: string, inPlaceOrMsgId?: boolean | number, noticeText?: string): Promise<void> {
    if (!this.isAuthorized(ctx)) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const editState = ctx.from ? await this.service.getEditState?.(BigInt(ctx.from.id)) : null;
    if (ctx.from) await this.service.clearEditState?.(BigInt(ctx.from.id));
    const site = await this.service.getSiteByCode(code);
    if (!site) return this.renderSitesHub(ctx, inPlaceOrMsgId, '❌ الموقع المطلوب غير موجود.');
    const keyboard = buildSiteDetailKeyboard(site, ctx.isImpersonating);
    const text = formatSiteDetailCard(site, noticeText);
    const activeMessageId = typeof inPlaceOrMsgId === 'number' && inPlaceOrMsgId > 0 ? inPlaceOrMsgId : editState?.promptMessageId ?? ctx.callbackQuery?.message?.message_id;
    await InPlaceFlowManager.renderStep(ctx, { prompt: text, keyboard, activeMessageId, flowType: 'site_detail', disableWebPagePreview: true });
  }

  async handleToggleSite(ctx: SettingsModuleContext, code: string): Promise<void> {
    if (!this.isAuthorized(ctx)) return;
    const updated = await this.service.toggleSiteStatus(code);
    const notice = updated.status === 'ACTIVE' ? `تم إعادة تنشيط موقع (${updated.name}) بنجاح.` : `تم إيقاف موقع (${updated.name}) مؤقتاً.`;
    await this.renderSiteDetail(ctx, code, true, notice);
  }

  async handleStartAddSite(ctx: SettingsModuleContext): Promise<void> {
    if (!this.isAuthorized(ctx) || !ctx.from || !ctx.callbackQuery) return;
    await ctx.answerCallbackQuery().catch(() => {});
    const promptMessageId = ctx.callbackQuery.message?.message_id || 0;
    await this.service.setWizardState(BigInt(ctx.from.id), { step: 'AWAIT_NAME', promptMessageId, timestamp: Date.now() });
    await InPlaceFlowManager.renderStep(ctx, { prompt: formatAddSiteNamePrompt(), activeMessageId: promptMessageId, flowType: 'site_registration' });
  }

  async handleBackToName(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state) return;
    state.step = 'AWAIT_NAME';
    await this.service.setWizardState(BigInt(ctx.from.id), state);
    await InPlaceFlowManager.renderStep(ctx, { prompt: formatAddSiteNamePrompt(), activeMessageId: state.promptMessageId, flowType: 'site_registration' });
  }

  async handleConfirmCode(ctx: SettingsModuleContext, confirmedCode: string): Promise<void> {
    if (!ctx.from) return;
    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state?.name) return;
    state.code = confirmedCode;
    state.step = 'SELECT_GOV';
    await this.service.setWizardState(BigInt(ctx.from.id), state);
    await InPlaceFlowManager.renderStep(ctx, { prompt: formatSelectGovPrompt(state.name), keyboard: buildGovPickerKeyboard(), activeMessageId: state.promptMessageId, flowType: 'site_registration' });
  }

  async handleSelectGov(ctx: SettingsModuleContext, gov: string, siteCode?: string): Promise<void> {
    if (!ctx.from) return;
    if (siteCode) {
      const res = await this.service.updateField(siteCode, 'gov', gov);
      const notice = res.success ? `تم تحديث المحافظة إلى: ${gov}` : `❌ فشل تحديث المحافظة: ${res.error}`;
      await this.renderSiteDetail(ctx, siteCode, true, notice);
      return;
    }
    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state?.name) return;
    state.gov = gov;
    state.step = 'AWAIT_LOCATION';
    await this.service.setWizardState(BigInt(ctx.from.id), state);
    await InPlaceFlowManager.renderStep(ctx, { prompt: formatSiteLocationPrompt(state.name), keyboard: buildSiteLocationPromptKeyboard(), activeMessageId: state.promptMessageId, flowType: 'site_registration' });
  }

  async handleSkipLocation(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state?.name) return;
    state.latitude = undefined;
    state.longitude = undefined;
    state.step = 'SELECT_GEOFENCE';
    await this.service.setWizardState(BigInt(ctx.from.id), state);
    await InPlaceFlowManager.renderStep(ctx, { prompt: formatSelectGeofencePrompt(state.name), keyboard: buildGeofencePickerKeyboard(), activeMessageId: state.promptMessageId, flowType: 'site_registration' });
  }

  async handleBackToLocation(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state?.name) return;
    state.step = 'AWAIT_LOCATION';
    await this.service.setWizardState(BigInt(ctx.from.id), state);
    await InPlaceFlowManager.renderStep(ctx, { prompt: formatSiteLocationPrompt(state.name), keyboard: buildSiteLocationPromptKeyboard(), activeMessageId: state.promptMessageId, flowType: 'site_registration' });
  }

  async handleBackToGov(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state?.name) return;
    state.step = 'SELECT_GOV';
    await this.service.setWizardState(BigInt(ctx.from.id), state);
    await InPlaceFlowManager.renderStep(ctx, { prompt: formatSelectGovPrompt(state.name), keyboard: buildGovPickerKeyboard(), activeMessageId: state.promptMessageId, flowType: 'site_registration' });
  }

  async handleBackToCode(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state?.name) return;
    const code = state.code || (await this.service.getNextSuggestedCode());
    state.code = code;
    state.step = 'CONFIRM_CODE';
    await this.service.setWizardState(BigInt(ctx.from.id), state);
    await InPlaceFlowManager.renderStep(ctx, { prompt: formatConfirmCodePrompt(state.name, code), keyboard: buildConfirmCodeKeyboard(code), activeMessageId: state.promptMessageId, flowType: 'site_registration' });
  }

  async handleSelectGeofence(ctx: SettingsModuleContext, radius: number, siteCode?: string): Promise<void> {
    if (!ctx.from) return;
    if (siteCode) {
      const res = await this.service.updateField(siteCode, 'geofence', radius);
      const notice = res.success ? `تم تحديث نطاق السياج إلى: ${radius} متر` : `❌ فشل تحديث نطاق السياج: ${res.error}`;
      await this.renderSiteDetail(ctx, siteCode, true, notice);
      return;
    }
    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state?.name || !state.code) return;
    const res = await this.service.createSite({
      name: state.name,
      code: state.code,
      governorate: state.gov,
      geofenceRadiusMeters: radius,
      projectId: state.projectId,
      latitude: state.latitude,
      longitude: state.longitude,
    });
    await this.service.clearWizardState(BigInt(ctx.from.id));
    if (!res.success || !res.site) {
      await this.renderSitesHub(ctx, true, `❌ فشل إنشاء الموقع: ${res.error}`);
      return;
    }
    const keyboard = buildCompletionKeyboard({
      repeatButtonText: '➕ إضافة موقع آخر',
      repeatCallbackData: 'action:site:add_new',
      sectionButtonText: '🔙 العودة لقائمة المواقع',
      sectionCallbackData: 'action:settings:sites_hub',
      mainMenuCallbackData: 'action:main_menu',
    });
    await InPlaceFlowManager.renderCompletion(ctx, { prompt: formatSiteCreationSuccessCard(res.site), keyboard, activeMessageId: state.promptMessageId, flowType: 'site_registration' });
  }

  async handleGovPageChange(ctx: SettingsModuleContext, page: number, siteCode?: string): Promise<void> {
    if (!ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const keyboard = buildGovPickerKeyboard(siteCode, page);
    if (siteCode) {
      await InPlaceFlowManager.renderStep(ctx, { prompt: 'اختر المحافظة الجديدة:', keyboard });
      return;
    }
    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    const text = formatSelectGovPrompt(state?.name || '');
    await InPlaceFlowManager.renderStep(ctx, { prompt: text, keyboard, activeMessageId: state?.promptMessageId, flowType: 'site_registration' });
  }

  async handleLocationInput(ctx: SettingsModuleContext): Promise<boolean> {
    if (!ctx.from) return false;
    const loc = parseTelegramLocation(ctx);
    if (!loc) return false;
    const telegramId = BigInt(ctx.from.id);
    const wizard = await this.service.getWizardState(telegramId);
    if (wizard && wizard.step === 'AWAIT_LOCATION') {
      wizard.latitude = loc.latitude;
      wizard.longitude = loc.longitude;
      wizard.step = 'SELECT_GEOFENCE';
      await this.service.setWizardState(telegramId, wizard);
      await InPlaceFlowManager.renderStep(ctx, { prompt: formatSelectGeofencePrompt(wizard.name || ''), keyboard: buildGeofencePickerKeyboard(), activeMessageId: wizard.promptMessageId, flowType: 'site_registration', deleteUserInput: true });
      return true;
    }
    const editState = await this.service.getEditState(telegramId);
    if (editState && editState.fieldKey === 'location') {
      const promptMessageId = editState.promptMessageId;
      await this.service.clearEditState(telegramId);
      const res = await this.service.updateField(editState.siteCode, 'location', `${loc.latitude},${loc.longitude}`);
      await InPlaceFlowManager.deleteUserInput(ctx);
      const notice = res.success
        ? `📍 تم تحديث الموقع الجغرافي بنجاح: (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`
        : `❌ فشل تحديث الموقع الجغرافي: ${res.error}`;
      await this.renderSiteDetail(ctx, editState.siteCode, promptMessageId, notice);
      return true;
    }
    return false;
  }

  async handleTextInput(ctx: SettingsModuleContext): Promise<boolean> {
    if (!ctx.from || !ctx.message?.text) return false;
    const telegramId = BigInt(ctx.from.id);
    const wizard = await this.service.getWizardState(telegramId);
    if (wizard) {
      if (wizard.step === 'AWAIT_NAME') {
        const siteName = ctx.message.text.trim();
        wizard.name = siteName;
        const suggestedCode = await this.service.getNextSuggestedCode();
        wizard.code = suggestedCode;
        wizard.step = 'CONFIRM_CODE';
        await this.service.setWizardState(telegramId, wizard);
        await InPlaceFlowManager.renderStep(ctx, { prompt: formatConfirmCodePrompt(siteName, suggestedCode), keyboard: buildConfirmCodeKeyboard(suggestedCode), activeMessageId: wizard.promptMessageId, flowType: 'site_registration', deleteUserInput: true });
        return true;
      }
      if (wizard.step === 'CONFIRM_CODE') {
        const customCode = ctx.message.text.trim().toUpperCase();
        const existing = await this.service.getSiteByCode(customCode);
        if (existing) {
          await InPlaceFlowManager.deleteUserInput(ctx);
          await InPlaceFlowManager.renderStep(ctx, { prompt: `⚠️ *الكود (${customCode}) مستخدم مسبقاً لموقع آخر!*\n\n${formatConfirmCodePrompt(wizard.name || '', wizard.code || '')}`, keyboard: buildConfirmCodeKeyboard(wizard.code || ''), activeMessageId: wizard.promptMessageId, flowType: 'site_registration' });
          return true;
        }
        wizard.code = customCode;
        wizard.step = 'SELECT_GOV';
        await this.service.setWizardState(telegramId, wizard);
        await InPlaceFlowManager.renderStep(ctx, { prompt: formatSelectGovPrompt(wizard.name || ''), keyboard: buildGovPickerKeyboard(), activeMessageId: wizard.promptMessageId, flowType: 'site_registration', deleteUserInput: true });
        return true;
      }
      if (wizard.step === 'AWAIT_LOCATION') {
        const loc = parseTelegramLocation(ctx);
        if (loc) return this.handleLocationInput(ctx);
        await InPlaceFlowManager.deleteUserInput(ctx);
        await InPlaceFlowManager.renderStep(ctx, {
          prompt: `⚠️ *تعذر قراءة الإحداثيات!* أرسل دبوس الموقع 📎 أو إحداثيات صحيحة (مثال: \`30.0444, 31.2357\`):\n\n${formatSiteLocationPrompt(wizard.name || '')}`,
          keyboard: buildSiteLocationPromptKeyboard(),
          activeMessageId: wizard.promptMessageId,
          flowType: 'site_registration',
        });
        return true;
      }
    }
    const editState = await this.service.getEditState(telegramId);
    if (editState) {
      if (editState.fieldKey === 'location') {
        const loc = parseTelegramLocation(ctx);
        if (loc) return this.handleLocationInput(ctx);
        await InPlaceFlowManager.deleteUserInput(ctx);
        await InPlaceFlowManager.renderStep(ctx, {
          prompt: `⚠️ *تعذر قراءة الإحداثيات!* أرسل دبوس الموقع 📎 أو إحداثيات صحيحة (مثال: \`30.0444, 31.2357\`):\n\n📍 *تحديث إحداثيات الموقع (GPS):* \`${editState.siteCode}\``,
          keyboard: buildSiteLocationPromptKeyboard(editState.siteCode),
          activeMessageId: editState.promptMessageId,
          flowType: 'site_edit',
        });
        return true;
      }
      const textVal = ctx.message.text.trim();
      const promptMessageId = editState.promptMessageId;
      await InPlaceFlowManager.deleteUserInput(ctx);
      await this.service.clearEditState(telegramId);
      const res = await this.service.updateField(editState.siteCode, editState.fieldKey, textVal);
      const notice = res.success ? `تم تحديث [${editState.fieldKey}] بنجاح.` : `❌ فشل التحديث: ${res.error}`;
      await this.renderSiteDetail(ctx, editState.siteCode, promptMessageId, notice);
      return true;
    }
    return false;
  }

  async handleEditMenu(ctx: SettingsModuleContext, siteCode: string): Promise<void> {
    if (!this.isAuthorized(ctx)) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const keyboard = buildSiteEditMenuKeyboard(siteCode);
    await InPlaceFlowManager.renderStep(ctx, { prompt: `⚙️ *خيارات تعديل بيانات الموقع:* \`${siteCode}\`\nاختر الحقل المراد تعديله:`, keyboard, flowType: 'site_edit' });
  }

  async handleStartEditField(ctx: SettingsModuleContext, fieldKey: SiteFieldKey, siteCode: string): Promise<void> {
    if (!ctx.from || !ctx.callbackQuery) return;
    await ctx.answerCallbackQuery().catch(() => {});
    const messageId = ctx.callbackQuery.message?.message_id || 0;
    await this.service.setEditState(BigInt(ctx.from.id), { siteCode, fieldKey, promptMessageId: messageId, timestamp: Date.now() });
    if (fieldKey === 'gov') return void (await InPlaceFlowManager.renderStep(ctx, { prompt: 'اختر المحافظة الجديدة:', keyboard: buildGovPickerKeyboard(siteCode), activeMessageId: messageId }));
    if (fieldKey === 'geofence') return void (await InPlaceFlowManager.renderStep(ctx, { prompt: 'اختر نصف قطر السياج الجغرافي الجديد:', keyboard: buildGeofencePickerKeyboard(siteCode), activeMessageId: messageId }));
    if (fieldKey === 'project') {
      const projects = await this.service.listProjects();
      return void (await InPlaceFlowManager.renderStep(ctx, { prompt: 'اختر المشروع التابع له الموقع:', keyboard: buildProjectsPickerKeyboard(projects, siteCode), activeMessageId: messageId }));
    }
    if (fieldKey === 'location') {
      return void (await InPlaceFlowManager.renderStep(ctx, { prompt: `📍 *تحديث إحداثيات الموقع (GPS):* \`${siteCode}\`\n\nأرسل الموقع الجغرافي الآن عبر التيليجرام 📎:`, keyboard: buildSiteLocationPromptKeyboard(siteCode), activeMessageId: messageId }));
    }
    await InPlaceFlowManager.renderStep(ctx, { prompt: `أرسل القيمة الجديدة لحقل [${fieldKey}] الآن في رسالة:`, activeMessageId: messageId });
  }

  async handleSelectProject(ctx: SettingsModuleContext, projectId: string, siteCode?: string): Promise<void> {
    if (!ctx.from) return;
    if (siteCode) {
      const res = await this.service.updateField(siteCode, 'project', projectId);
      const notice = res.success ? 'تم ربط الموقع بالمشروع بنجاح.' : `❌ فشل ربط الموقع بالمشروع: ${res.error}`;
      await this.renderSiteDetail(ctx, siteCode, true, notice);
      return;
    }
    const state = await this.service.getWizardState(BigInt(ctx.from.id));
    if (!state) return;
    state.projectId = projectId;
    await this.service.setWizardState(BigInt(ctx.from.id), state);
  }
}
