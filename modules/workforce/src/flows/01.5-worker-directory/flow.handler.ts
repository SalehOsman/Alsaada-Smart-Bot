import type { Context } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerDirectoryService } from './flow.service.js';
import { WorkerDirectoryMessages } from './flow.messages.js';
import { WorkerDirectoryKeyboards } from './flow.keyboard.js';
import { normalizeDigits } from '@alsaada/regional-engine';
import { validateDirectorySearchQuery, validateDirectoryPage, validateWorkerIdParam } from './flow.validators.js';

export class WorkerDirectoryHandler {
  constructor(private readonly service: WorkerDirectoryService) {}

  private checkRbac(ctx: WorkforceModuleContext): boolean {
    const role = ctx.effectiveRole || 'GUEST';
    const blockedRoles = ['WORKER', 'SUPPLIER', 'GUEST'];
    return !blockedRoles.includes(role);
  }

  private async replyOrEdit(
    ctx: Context,
    text: string,
    keyboard?: ReturnType<typeof WorkerDirectoryKeyboards.profile360ActionsKeyboard>
  ): Promise<void> {
    if (ctx.callbackQuery?.message) {
      try {
        if (keyboard) {
          await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          });
        } else {
          await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
          });
        }
        return;
      } catch {
        // Fallback to sending new message if edit fails
      }
    }
    if (keyboard) {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown' });
    }
  }

  async handleDirectory(
    ctx: WorkforceModuleContext,
    page = 1,
    searchQuery?: string
  ): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    if (!this.checkRbac(ctx)) {
      await this.replyOrEdit(ctx, '⛔ عذراً، لا تملك الصلاحية للوصول إلى دليل العاملين.');
      return;
    }

    const validatedPage = validateDirectoryPage(page);
    const result = await this.service.getDirectoryPage({
      page: validatedPage,
      pageSize: 10,
      searchQuery,
      siteId: ctx.assignedSiteId || undefined,
    });

    const text = WorkerDirectoryMessages.directoryHeader(
      result.totalCount,
      result.page,
      result.totalPages,
      searchQuery
    );

    const keyboard = WorkerDirectoryKeyboards.directoryKeyboard(
      result.items,
      {
        page: result.page,
        totalPages: result.totalPages,
        totalItems: result.totalCount,
        pageSize: 10,
      },
      searchQuery
    );

    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleViewWorker(
    ctx: WorkforceModuleContext,
    workerId: string,
    isIdRevealed = false
  ): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    if (!this.checkRbac(ctx)) {
      await this.replyOrEdit(ctx, '⛔ عذراً، لا تملك الصلاحية للاطلاع على بطاقة العامل.');
      return;
    }

    const val = validateWorkerIdParam(workerId);
    if (!val.isValid) {
      await this.replyOrEdit(ctx, WorkerDirectoryMessages.notFound());
      return;
    }

    const isSuper = ctx.isImpersonating ? ctx.effectiveRole === 'SUPER_ADMIN' : Boolean(ctx.isRealSuperAdmin || ctx.effectiveRole === 'SUPER_ADMIN');
    const role = isSuper ? 'SUPER_ADMIN' : (ctx.effectiveRole || 'GUEST');
    const profile = await this.service.getWorkerProfile360(workerId, role);
    if (!profile) {
      await this.replyOrEdit(ctx, WorkerDirectoryMessages.notFound());
      return;
    }

    const text = WorkerDirectoryMessages.profile360Card(profile, isIdRevealed);
    const keyboard = WorkerDirectoryKeyboards.profile360ActionsKeyboard({
      workerId,
      whatsAppUrl: profile.directWhatsAppUrl,
      hasPhone: Boolean(profile.phone),
      hasMissingData: !profile.isProfileComplete,
      canRevealId: profile.canRevealId,
      isIdRevealed,
      idNumber: profile.idNumberFull || profile.idNumberMasked,
      phone: profile.phone || undefined,
    });

    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleToggleNationalId(
    ctx: WorkforceModuleContext,
    workerId: string,
    reveal: boolean
  ): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    if (!this.checkRbac(ctx)) {
      await this.replyOrEdit(ctx, '⛔ عذراً، لا تملك الصلاحية لتغيير عرض الرقم القومي.');
      return;
    }
    await this.handleViewWorker(ctx, workerId, reveal);
  }

  async handleMissingDataWhatsApp(
    ctx: WorkforceModuleContext,
    workerId: string
  ): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    if (!this.checkRbac(ctx)) {
      await this.replyOrEdit(ctx, '⛔ عذراً، لا تملك الصلاحية لطلب استكمال النواقص.');
      return;
    }

    const val = validateWorkerIdParam(workerId);
    if (!val.isValid) {
      await this.replyOrEdit(ctx, WorkerDirectoryMessages.notFound());
      return;
    }

    const role = ctx.effectiveRole || 'GUEST';
    const profile = await this.service.getWorkerProfile360(workerId, role);
    if (!profile) {
      await this.replyOrEdit(ctx, WorkerDirectoryMessages.notFound());
      return;
    }

    const messageText = WorkerDirectoryMessages.formatMissingDataWhatsAppMessage(profile);
    const text = WorkerDirectoryMessages.missingDataDispatchCard(profile, messageText);
    const keyboard = WorkerDirectoryKeyboards.missingDataDispatchKeyboard(
      workerId,
      profile.directWhatsAppUrl
    );

    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleNoPhoneAlert(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: '⚠️ لا يوجد رقم هاتف مسجل لهذا العامل في المنظومة.',
        show_alert: true,
      }).catch(() => {});
    }
  }

  async handleCallWorker(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    const val = validateWorkerIdParam(workerId);
    if (!val.isValid) {
      await ctx.reply('⚠️ لم يتم العثور على العامل.');
      return;
    }
    const role = ctx.effectiveRole || 'GUEST';
    const profile = await this.service.getWorkerProfile360(workerId, role);
    if (!profile || !profile.phone) {
      await ctx.reply('⚠️ لا يوجد رقم هاتف مسجل لهذا العامل.');
      return;
    }
    const rawDigits = profile.phone.replace(/\D/g, '');
    const cleanPhone = normalizeDigits(rawDigits);
    const intlPhone = cleanPhone.startsWith('2')
      ? `+${cleanPhone}`
      : (cleanPhone.startsWith('0') ? `+20${cleanPhone.slice(1)}` : `+20${cleanPhone}`);
    const displayName = profile.nickname || profile.name;

    await ctx.reply(
      `📞 *الاتصال المباشر بالعامل:*\n━━━━━━━━━━━━━━━━━━━━━\n• *الاسم:* ${displayName}\n• *رقم الهاتف:* ${intlPhone}\n\n_انقر على الرقم أعلاه للاتصال به مباشرة من هاتفك._`,
      { parse_mode: 'Markdown' }
    );
  }

  private readonly searchPendingUsers = new Set<string>();

  isSearching(userId: string): boolean {
    return this.searchPendingUsers.has(userId);
  }

  async handleSearchPrompt(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    if (ctx.from) {
      this.searchPendingUsers.add(String(ctx.from.id));
    }
    const text = WorkerDirectoryMessages.searchPrompt();
    const keyboard = WorkerDirectoryKeyboards.searchPromptKeyboard();
    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleSearchInput(ctx: WorkforceModuleContext, rawQuery: string): Promise<void> {
    if (ctx.from) {
      this.searchPendingUsers.delete(String(ctx.from.id));
    }
    await ctx.deleteMessage().catch(() => {});
    const val = validateDirectorySearchQuery(rawQuery);
    if (!val.isValid || !val.cleanQuery) {
      await this.replyOrEdit(ctx, `⚠️ ${val.error || 'نص البحث غير صالح'}`);
      return;
    }
    await this.handleDirectory(ctx, 1, val.cleanQuery);
  }

  async handleClearSearch(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.from) {
      this.searchPendingUsers.delete(String(ctx.from.id));
    }
    await this.handleDirectory(ctx, 1, undefined);
  }
}
