import { InputFile } from 'grammy';
import { EGYPTIAN_GOVERNORATES } from '@alsaada/national-id-engine';
import { WorkerExportService } from './flow.service.js';
import { WorkerExportKeyboards } from './flow.keyboard.js';
import { FLOW_MESSAGES } from './flow.messages.js';
import { WorkerExportTelemetry } from './flow.telemetry.js';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import type { WorkerExportFilter } from './flow.types.js';

export class WorkerExportHandler {
  constructor(private readonly service: WorkerExportService) {}

  async handleDownloadTemplate(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: FLOW_MESSAGES.TEMPLATE_DOWNLOADING });
    }

    if (!ctx.isRealSuperAdmin) {
      await ctx.reply(FLOW_MESSAGES.UNAUTHORIZED_SUPER_ADMIN);
      return;
    }

    try {
      const buffer = await WorkerExportTelemetry.measure('download_template', () =>
        this.service.generateTemplateBuffer()
      );
      const file = new InputFile(buffer, 'قالب_استيراد_العمالة_شركة_السعادة.xlsx');
      await ctx.replyWithDocument(file, {
        caption: FLOW_MESSAGES.TEMPLATE_CAPTION,
        parse_mode: 'Markdown',
        reply_markup: WorkerExportKeyboards.templateDownloadKeyboard(),
      });
    } catch {
      await ctx.reply(FLOW_MESSAGES.TEMPLATE_ERROR);
    }
  }

  async handleStartUpload(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }

    if (!ctx.isRealSuperAdmin) {
      await ctx.reply(FLOW_MESSAGES.UNAUTHORIZED_SUPER_ADMIN);
      return;
    }

    const kb = WorkerExportKeyboards.uploadPromptKeyboard();
    const text = FLOW_MESSAGES.UPLOAD_START_PROMPT;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
        return;
      } catch {
        // Fallback to reply if edit fails
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }

  async handleDocumentUpload(
    ctx: WorkforceModuleContext,
    fileBuffer: Buffer
  ): Promise<boolean> {
    if (!ctx.isRealSuperAdmin) {
      await ctx.reply(FLOW_MESSAGES.UNAUTHORIZED_SUPER_ADMIN);
      return false;
    }

    const result = await WorkerExportTelemetry.measure('import_excel', () =>
      this.service.parseAndImportExcel(fileBuffer)
    );

    if (!result.success) {
      const errorList = result.errors.slice(0, 6).join('\n• ');
      const extraCount =
        result.errors.length > 6
          ? `\n_...وهناك ${result.errors.length - 6} أخطاء أخرى._`
          : '';

      const retryKb = WorkerExportKeyboards.errorRetryKeyboard(
        'action:worker:upload_excel',
        'menu:domain:hr'
      );
      await ctx.reply(
        FLOW_MESSAGES.IMPORT_VALIDATION_ERROR(errorList, extraCount),
        {
          parse_mode: 'Markdown',
          reply_markup: retryKb,
        }
      );
      return true;
    }

    const successKb = WorkerExportKeyboards.importSuccessKeyboard();
    await ctx.reply(
      FLOW_MESSAGES.IMPORT_SUCCESS(result.totalRowsProcessed, result.workersCreated),
      {
        parse_mode: 'Markdown',
        reply_markup: successKb,
      }
    );
    return true;
  }

  async handleExportStart(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }

    const role = ctx.effectiveRole || 'GUEST';
    if (role === 'GUEST' || role === 'WORKER' || role === 'SUPPLIER') {
      await ctx.reply(FLOW_MESSAGES.UNAUTHORIZED_ADMIN);
      return;
    }

    const kb = WorkerExportKeyboards.exportMenuKeyboard();
    const text = FLOW_MESSAGES.EXPORT_MENU_PROMPT;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
        return;
      } catch {
        // Fallback to reply
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }

  async handleExportExecute(
    ctx: WorkforceModuleContext,
    filter: WorkerExportFilter
  ): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: FLOW_MESSAGES.EXPORT_GENERATING });
    }

    const isSuperAdmin = Boolean(ctx.isRealSuperAdmin);
    try {
      const exportResult = await WorkerExportTelemetry.measure('generate_export', () =>
        this.service.generateWorkersExportBuffer(filter, isSuperAdmin)
      );

      if (exportResult.workerCount === 0) {
        await ctx.reply(FLOW_MESSAGES.EXPORT_EMPTY);
        return;
      }

      const file = new InputFile(exportResult.buffer, exportResult.fileName);
      const caption = FLOW_MESSAGES.EXPORT_SUCCESS_CAPTION(
        exportResult.filterLabel,
        exportResult.workerCount,
        isSuperAdmin
      );

      await ctx.replyWithDocument(file, {
        caption,
        parse_mode: 'Markdown',
        reply_markup: WorkerExportKeyboards.exportSuccessKeyboard(),
      });
    } catch {
      await ctx.reply(FLOW_MESSAGES.EXPORT_ERROR);
    }
  }

  async handleDepartmentMenu(
    ctx: WorkforceModuleContext,
    departments: Array<{ id: string; name: string; code: string }>
  ): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }

    const kb = WorkerExportKeyboards.departmentFilterKeyboard(departments);
    const text = FLOW_MESSAGES.EXPORT_DEPT_PROMPT;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
        return;
      } catch {
        // Fallback
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }

  async handleJobTitleMenu(
    ctx: WorkforceModuleContext,
    jobs: Array<{ id: string; name: string; code: string }>,
    page: number,
    totalPages: number
  ): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }

    const kb = WorkerExportKeyboards.jobTitleFilterKeyboard(jobs, page, totalPages);
    const text = FLOW_MESSAGES.EXPORT_JOB_PROMPT(page, totalPages);

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
        return;
      } catch {
        // Fallback
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }

  async handleGovernorateMenu(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }

    const govMap: Record<string, string> = {};
    for (const [code, info] of Object.entries(EGYPTIAN_GOVERNORATES)) {
      govMap[code] = info.nameAr;
    }

    const kb = WorkerExportKeyboards.governorateFilterKeyboard(govMap);
    const text = FLOW_MESSAGES.EXPORT_GOV_PROMPT;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
        return;
      } catch {
        // Fallback
      }
    }
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }
}
