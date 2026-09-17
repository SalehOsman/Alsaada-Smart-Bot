import type { Bot, Context } from 'grammy';
import { InputFile, InlineKeyboard } from 'grammy';
import { formatCommitmentCard } from '@alsaada/core-components';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerCommitmentService } from './flow.service.js';
import { WorkerCommitmentMessages } from './flow.messages.js';
import { WorkerCommitmentKeyboards } from './flow.keyboard.js';
import { WorkerCommitmentTelemetry } from './flow.telemetry.js';

export class WorkerCommitmentHandler {
  private activeQueries = new Set<string>();
  private activeSearchQueries = new Map<string, string>();

  constructor(private readonly service: WorkerCommitmentService) {}

  registerRoutes(bot: Bot<WorkforceModuleContext>): void {
    bot.callbackQuery('menu:wcs:main', async (ctx) => {
      await this.handleMainMenu(ctx);
    });

    bot.callbackQuery('action:wcs:query', async (ctx) => {
      if (ctx.from) {
        this.activeQueries.delete(ctx.from.id.toString());
        this.activeSearchQueries.delete(ctx.from.id.toString());
      }
      await this.handleWorkerPicker(ctx, 1);
    });

    bot.callbackQuery('action:wcs:picker:search_prompt', async (ctx) => {
      await this.handleSearchPrompt(ctx);
    });

    bot.callbackQuery('action:wcs:picker:clear_search', async (ctx) => {
      await this.handleClearSearch(ctx);
    });

    bot.callbackQuery(/^action:wcs:picker:page:(\d+)$/, async (ctx) => {
      const rawPage = Array.isArray(ctx.match) ? ctx.match[1] : undefined;
      const page = rawPage ? parseInt(rawPage, 10) || 1 : 1;
      const searchQuery = ctx.from ? this.activeSearchQueries.get(ctx.from.id.toString()) : undefined;
      await this.handleWorkerPicker(ctx, page, searchQuery);
    });

    bot.callbackQuery('action:wcs:under_review', async (ctx) => {
      await this.handleUnderReview(ctx, 1);
    });

    bot.callbackQuery(/^action:wcs:under_review:page:(\d+)$/, async (ctx) => {
      const rawPage = Array.isArray(ctx.match) ? ctx.match[1] : undefined;
      const page = rawPage ? parseInt(rawPage, 10) || 1 : 1;
      await this.handleUnderReview(ctx, page);
    });

    bot.callbackQuery('action:wcs:honor_roll', async (ctx) => {
      await this.handleHonorRoll(ctx, 1);
    });

    bot.callbackQuery(/^action:wcs:honor_roll:page:(\d+)$/, async (ctx) => {
      const rawPage = Array.isArray(ctx.match) ? ctx.match[1] : undefined;
      const page = rawPage ? parseInt(rawPage, 10) || 1 : 1;
      await this.handleHonorRoll(ctx, page);
    });

    bot.callbackQuery(/^action:wcs:card:(.+)$/, async (ctx) => {
      const workerId = Array.isArray(ctx.match) ? ctx.match[1] : undefined;
      if (workerId) {
        await this.handleWorkerCard(ctx, workerId);
      }
    });

    bot.callbackQuery('action:wcs:export_excel', async (ctx) => {
      await this.handleExportExcel(ctx);
    });
  }

  async handleMainMenu(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    if (ctx.from) {
      this.activeQueries.delete(ctx.from.id.toString());
      this.activeSearchQueries.delete(ctx.from.id.toString());
    }

    await WorkerCommitmentTelemetry.measure('mainMenu', async () => {
      const siteId = ctx.assignedSiteId || undefined;
      const stats = await this.service.getStatsSummary(siteId);
      const text = WorkerCommitmentMessages.mainMenu(stats);
      const kb = WorkerCommitmentKeyboards.mainMenuKeyboard();

      await this.replyOrEdit(ctx, text, kb);
    }, ctx.from?.id.toString());
  }

  async handleWorkerPicker(ctx: WorkforceModuleContext, page = 1, searchQuery?: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    await WorkerCommitmentTelemetry.measure('workerPicker', async () => {
      const siteId = ctx.assignedSiteId || undefined;
      const result = await this.service.getWorkersPickerPage({
        siteId,
        search: searchQuery,
        page,
        pageSize: 8,
      });

      const text = WorkerCommitmentMessages.pickerHeader(
        result.pagination.totalItems,
        result.pagination.page,
        result.pagination.totalPages,
        result.siteName,
        searchQuery
      );
      const kb = WorkerCommitmentKeyboards.workerPickerKeyboard({
        workers: result.items,
        pagination: result.pagination,
        searchQuery,
      });

      await this.replyOrEdit(ctx, text, kb);
    }, ctx.from?.id.toString());
  }

  async handleSearchPrompt(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    if (ctx.from) {
      this.activeQueries.add(ctx.from.id.toString());
    }

    const text = WorkerCommitmentMessages.searchPrompt();
    const kb = WorkerCommitmentKeyboards.searchCancelKeyboard();
    await this.replyOrEdit(ctx, text, kb);
  }

  async handleClearSearch(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    if (ctx.from) {
      this.activeSearchQueries.delete(ctx.from.id.toString());
    }
    await this.handleWorkerPicker(ctx, 1);
  }

  async handleUnderReview(ctx: WorkforceModuleContext, page = 1): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    await WorkerCommitmentTelemetry.measure('underReview', async () => {
      const siteId = ctx.assignedSiteId || undefined;
      const result = await this.service.getWorkersUnderReview({ siteId, page, pageSize: 8 });

      const text = WorkerCommitmentMessages.underReviewListHeader(result.total, result.page, result.totalPages);
      const kb = WorkerCommitmentKeyboards.commitmentListKeyboard(
        result.items,
        result.page,
        result.totalPages,
        'under_review'
      );

      await this.replyOrEdit(ctx, text, kb);
    }, ctx.from?.id.toString());
  }

  async handleHonorRoll(ctx: WorkforceModuleContext, page = 1): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    await WorkerCommitmentTelemetry.measure('honorRoll', async () => {
      const siteId = ctx.assignedSiteId || undefined;
      const result = await this.service.getHonorRoll({ siteId, page, pageSize: 8 });

      const text = WorkerCommitmentMessages.honorRollListHeader(result.total, result.page, result.totalPages);
      const kb = WorkerCommitmentKeyboards.commitmentListKeyboard(
        result.items,
        result.page,
        result.totalPages,
        'honor_roll'
      );

      await this.replyOrEdit(ctx, text, kb);
    }, ctx.from?.id.toString());
  }

  async handleWorkerCard(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    await WorkerCommitmentTelemetry.measure('workerCard', async () => {
      let result;
      const isMyCard = workerId === 'my';

      if (isMyCard && ctx.from) {
        result = await this.service.evaluateWorkerByTelegramId(BigInt(ctx.from.id));
      } else {
        result = await this.service.evaluateWorker(workerId);
      }

      if (!result) {
        await this.replyOrEdit(ctx, WorkerCommitmentMessages.workerNotFound());
        return;
      }

      const isWorkerRole = ctx.effectiveRole === 'WORKER';
      const text = formatCommitmentCard(result);
      const kb = WorkerCommitmentKeyboards.cardActionsKeyboard(result.workerId, isWorkerRole);

      await this.replyOrEdit(ctx, text, kb);
    }, ctx.from?.id.toString());
  }

  async handleExportExcel(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: '⏳ جاري إنشاء ملف التقييمات إكسيل...' }).catch(() => {});

    await WorkerCommitmentTelemetry.measure('exportExcel', async () => {
      const siteId = ctx.assignedSiteId || undefined;
      const buffer = await this.service.exportCommitmentExcel(siteId);
      const stats = await this.service.getStatsSummary(siteId);

      const fileName = `تقييم_والتزام_العمال_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const caption = WorkerCommitmentMessages.exportSuccessCaption(stats.totalEvaluated);

      await ctx.replyWithDocument(new InputFile(buffer, fileName), {
        caption,
        parse_mode: 'Markdown',
      });
    }, ctx.from?.id.toString());
  }

  async handleTextInput(ctx: WorkforceModuleContext, text: string): Promise<boolean> {
    if (!ctx.from) return false;
    const userId = ctx.from.id.toString();

    if (!this.activeQueries.has(userId)) {
      return false;
    }

    this.activeQueries.delete(userId);
    const query = text.trim();
    const siteId = ctx.assignedSiteId || undefined;

    const result = await this.service.getWorkersPickerPage({
      siteId,
      search: query,
      page: 1,
      pageSize: 8,
    });

    if (result.rawMatchingCount === 1 && result.singleMatch) {
      await this.handleWorkerCard(ctx, result.singleMatch.id);
      return true;
    }

    if (result.rawMatchingCount > 1) {
      this.activeSearchQueries.set(userId, query);
      const header = WorkerCommitmentMessages.pickerHeader(
        result.pagination.totalItems,
        result.pagination.page,
        result.pagination.totalPages,
        result.siteName,
        query
      );
      const kb = WorkerCommitmentKeyboards.workerPickerKeyboard({
        workers: result.items,
        pagination: result.pagination,
        searchQuery: query,
      });
      await ctx.reply(header, { parse_mode: 'Markdown', reply_markup: kb });
      return true;
    }

    const notFoundMsg = WorkerCommitmentMessages.workerNotFound(query);
    const retryKb = new InlineKeyboard()
      .text('🔍 إعادة محاولة البحث', 'action:wcs:picker:search_prompt')
      .row()
      .text('👥 عرض كافة العمال', 'action:wcs:query')
      .row()
      .text('🔙 القائمة الرئيسية للمؤشر', 'menu:wcs:main');
    await ctx.reply(notFoundMsg, { reply_markup: retryKb });
    return true;
  }

  private async replyOrEdit(ctx: Context, text: string, keyboard?: InlineKeyboard): Promise<void> {
    const options = {
      parse_mode: 'Markdown' as const,
      ...(keyboard ? { reply_markup: keyboard } : {}),
    };
    if (ctx.callbackQuery?.message) {
      try {
        await ctx.editMessageText(text, options);
        return;
      } catch {}
    }
    await ctx.reply(text, options);
  }
}
