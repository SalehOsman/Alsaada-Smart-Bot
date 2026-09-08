import type { Context } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerDirectoryService } from './flow.service.js';
import { WorkerDirectoryMessages } from './flow.messages.js';
import { WorkerDirectoryKeyboards } from './flow.keyboard.js';
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
        await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        return;
      } catch {
        // Fallback to sending new message if edit fails
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
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

  async handleViewWorker(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
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

    const role = ctx.effectiveRole || 'GUEST';
    const profile = await this.service.getWorkerProfile360(workerId, role);
    if (!profile) {
      await this.replyOrEdit(ctx, WorkerDirectoryMessages.notFound());
      return;
    }

    const text = WorkerDirectoryMessages.profile360Card(profile);
    const keyboard = WorkerDirectoryKeyboards.profile360ActionsKeyboard(
      workerId,
      profile.directWhatsAppUrl
    );

    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleSearchPrompt(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    const text = WorkerDirectoryMessages.searchPrompt();
    const keyboard = WorkerDirectoryKeyboards.searchPromptKeyboard();
    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleSearchInput(ctx: WorkforceModuleContext, rawQuery: string): Promise<void> {
    await ctx.deleteMessage().catch(() => {});
    const val = validateDirectorySearchQuery(rawQuery);
    if (!val.isValid || !val.cleanQuery) {
      await this.replyOrEdit(ctx, `⚠️ ${val.error || 'نص البحث غير صالح'}`);
      return;
    }
    await this.handleDirectory(ctx, 1, val.cleanQuery);
  }

  async handleClearSearch(ctx: WorkforceModuleContext): Promise<void> {
    await this.handleDirectory(ctx, 1, undefined);
  }
}
