import fs from 'node:fs';
import path from 'node:path';
import { type Context, InputFile, type InlineKeyboard } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerDirectoryService } from './flow.service.js';
import { WorkerDirectoryRepository } from './flow.repository.js';
import { WorkerDirectoryMessages } from './flow.messages.js';
import { WorkerDirectoryKeyboards } from './flow.keyboard.js';
import type { WorkerDocUploadState } from './flow.types.js';

export const DOC_CATEGORY_MAP_AR: Record<string, string> = {
  NATIONAL_ID: 'بطاقة الرقم القومي',
  PASSPORT: 'جواز السفر',
  WORK_PERMIT: 'تصريح العمل',
  CONTRACT: 'عقد عمل',
  DRIVING_LICENSE: 'رخصة قيادة',
  CRIMINAL_RECORD: 'فيش وتشبيه',
  HEALTH_CERTIFICATE: 'شهادة صحية',
  EDUCATION: 'مؤهل دراسي',
};

export class WorkerDocumentsHandler {
  private readonly uploadStates = new Map<string, WorkerDocUploadState>();

  constructor(
    private readonly service: WorkerDirectoryService,
    private readonly repository: WorkerDirectoryRepository
  ) {}

  private checkRbac(ctx: WorkforceModuleContext): boolean {
    const role = ctx.effectiveRole || 'GUEST';
    return !['WORKER', 'SUPPLIER', 'GUEST'].includes(role);
  }

  private async replyOrEdit(
    ctx: Context,
    text: string,
    keyboard?: InlineKeyboard
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
        // Fallback to sending new message
      }
    }
    if (keyboard) {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown' });
    }
  }

  isWaitingForDocFile(userId: string): boolean {
    const state = this.uploadStates.get(userId);
    return state?.step === 'AWAIT_FILE';
  }

  isWaitingForDocTitle(userId: string): boolean {
    const state = this.uploadStates.get(userId);
    return state?.step === 'CUSTOM_TITLE';
  }

  getUploadState(userId: string): WorkerDocUploadState | undefined {
    return this.uploadStates.get(userId);
  }

  clearUploadState(userId: string): void {
    this.uploadStates.delete(userId);
  }

  async handleListDocuments(
    ctx: WorkforceModuleContext,
    workerId: string
  ): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    if (!this.checkRbac(ctx)) {
      await this.replyOrEdit(ctx, '⛔ عذراً، لا تملك الصلاحية للوصول لمستندات العامل.');
      return;
    }

    const worker = await this.repository.findWorkerById(workerId);
    if (!worker || worker.isDeleted) {
      await this.replyOrEdit(ctx, WorkerDirectoryMessages.notFound());
      return;
    }

    const docs = await this.service.getWorkerDocuments(workerId);
    const text = WorkerDirectoryMessages.documentsListHeader(worker.name, worker.code, docs);
    const canUpload = this.checkRbac(ctx);
    const keyboard = WorkerDirectoryKeyboards.documentsListKeyboard(workerId, docs, canUpload);

    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleViewDocument(
    ctx: WorkforceModuleContext,
    docId: string
  ): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    if (!this.checkRbac(ctx)) {
      await this.replyOrEdit(ctx, '⛔ عذراً، لا تملك الصلاحية لمعاينة هذا المستند.');
      return;
    }

    const doc = await this.service.getDocumentById(docId);
    if (!doc) {
      await ctx.reply('⚠️ المستند غير موجود أو قد تم حذفه مسبقاً.');
      return;
    }

    const isSuper = ctx.isImpersonating ? ctx.effectiveRole === 'SUPER_ADMIN' : Boolean(ctx.isRealSuperAdmin || ctx.effectiveRole === 'SUPER_ADMIN');
    const canDelete = isSuper;
    const fullPath = path.resolve(process.cwd(), doc.fileUri);
    const fileExists = fs.existsSync(fullPath);

    const categoryAr = DOC_CATEGORY_MAP_AR[doc.category] || doc.category;
    const caption = WorkerDirectoryMessages.documentCaption(
      doc.title,
      doc.worker?.name || 'العامل',
      doc.worker?.code || '',
      categoryAr,
      doc.createdAt
    );
    const keyboard = WorkerDirectoryKeyboards.documentViewKeyboard(doc.id, doc.workerId, canDelete);

    if (!fileExists) {
      const text = `${caption}\n\n${WorkerDirectoryMessages.documentFileNotFound()}`;
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    }

    const isImage = doc.fileType.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(doc.fileName);

    try {
      if (isImage && typeof ctx.replyWithPhoto === 'function') {
        await ctx.replyWithPhoto(new InputFile(fullPath), {
          caption,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        return;
      }
      if (typeof ctx.replyWithDocument === 'function') {
        await ctx.replyWithDocument(new InputFile(fullPath, doc.fileName), {
          caption,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
        return;
      }
    } catch {
      // Fallback
    }

    await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleDeleteDocument(
    ctx: WorkforceModuleContext,
    docId: string
  ): Promise<void> {
    const isSuper = ctx.isImpersonating ? ctx.effectiveRole === 'SUPER_ADMIN' : Boolean(ctx.isRealSuperAdmin || ctx.effectiveRole === 'SUPER_ADMIN');
    if (!isSuper) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({
          text: '⛔ غير مصرح: حذف المستندات محصور حصراً بالسوبر أدمن والإدارة العليا.',
          show_alert: true,
        }).catch(() => {});
      }
      return;
    }

    const doc = await this.service.getDocumentById(docId);
    if (!doc) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({
          text: '⚠️ المستند غير موجود أو تم حذفه مسبقاً.',
          show_alert: true,
        }).catch(() => {});
      }
      return;
    }

    const workerId = doc.workerId;
    const title = doc.title;

    await this.service.deleteWorkerDocument(docId, 'SUPER_ADMIN');

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: WorkerDirectoryMessages.documentDeleteSuccess(title),
        show_alert: true,
      }).catch(() => {});
    }

    await this.handleListDocuments(ctx, workerId);
  }

  async handleStartAddDocument(
    ctx: WorkforceModuleContext,
    workerId: string
  ): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    if (!this.checkRbac(ctx)) {
      await this.replyOrEdit(ctx, '⛔ عذراً، لا تملك الصلاحية لرفع مستندات للعامل.');
      return;
    }

    const worker = await this.repository.findWorkerById(workerId);
    if (!worker || worker.isDeleted) {
      await this.replyOrEdit(ctx, WorkerDirectoryMessages.notFound());
      return;
    }

    if (ctx.from) {
      this.uploadStates.set(String(ctx.from.id), {
        workerId,
        workerCode: worker.code,
        workerName: worker.name,
        step: 'PICK_CATEGORY',
      });
    }

    const text = WorkerDirectoryMessages.documentCategoryPrompt(worker.name, worker.code);
    const keyboard = WorkerDirectoryKeyboards.documentCategoryPickerKeyboard(workerId);

    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleSelectDocCategory(
    ctx: WorkforceModuleContext,
    category: string,
    workerIdParam?: string
  ): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }

    const userId = String(ctx.from?.id);
    const state = this.uploadStates.get(userId);
    const workerId = workerIdParam || state?.workerId;
    if (!state || !workerId || (workerIdParam && state.workerId !== workerIdParam)) {
      if (workerId) await this.handleListDocuments(ctx, workerId);
      return;
    }

    if (category === 'CUSTOM') {
      state.step = 'CUSTOM_TITLE';
      const text = WorkerDirectoryMessages.customTitlePrompt();
      const keyboard = WorkerDirectoryKeyboards.cancelDocUploadKeyboard(workerId);
      await this.replyOrEdit(ctx, text, keyboard);
      return;
    }

    const title = DOC_CATEGORY_MAP_AR[category] || category;
    state.category = category;
    state.title = title;
    state.step = 'AWAIT_FILE';

    const text = WorkerDirectoryMessages.awaitFilePrompt(title);
    const keyboard = WorkerDirectoryKeyboards.cancelDocUploadKeyboard(workerId);
    await this.replyOrEdit(ctx, text, keyboard);
  }

  async handleCustomTitleInput(
    ctx: WorkforceModuleContext,
    rawText: string
  ): Promise<void> {
    const userId = String(ctx.from?.id);
    const state = this.uploadStates.get(userId);
    if (!state || state.step !== 'CUSTOM_TITLE') return;

    await ctx.deleteMessage().catch(() => {});

    const cleanTitle = rawText.trim();
    if (!cleanTitle || cleanTitle.length < 2) {
      await ctx.reply('⚠️ يرجى كتابة عنوان صحيح للمستند (حرفين على الأقل):');
      return;
    }

    state.category = 'OTHER';
    state.title = cleanTitle;
    state.step = 'AWAIT_FILE';

    const text = WorkerDirectoryMessages.awaitFilePrompt(cleanTitle);
    const keyboard = WorkerDirectoryKeyboards.cancelDocUploadKeyboard(state.workerId);
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }

  async handleDocumentFileInput(
    ctx: WorkforceModuleContext,
    fileInfo: { buffer: Buffer; fileName: string; mimeType: string }
  ): Promise<void> {
    const userId = String(ctx.from?.id);
    const state = this.uploadStates.get(userId);
    if (!state || state.step !== 'AWAIT_FILE') return;

    const uploadedBy = ctx.from ? BigInt(ctx.from.id) : undefined;
    const workerId = state.workerId;
    const title = state.title || 'مستند';

    await this.service.addWorkerDocument({
      workerId: state.workerId,
      workerCode: state.workerCode,
      originalFileName: fileInfo.fileName,
      fileBuffer: fileInfo.buffer,
      title,
      category: state.category || 'OTHER',
      mimeType: fileInfo.mimeType,
      uploadedBy,
    });

    this.uploadStates.delete(userId);

    await ctx.reply(WorkerDirectoryMessages.documentUploadSuccess(title), {
      parse_mode: 'Markdown',
    });

    await this.handleListDocuments(ctx, workerId);
  }

  async handleCancelDocUpload(
    ctx: WorkforceModuleContext,
    workerId: string
  ): Promise<void> {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }
    const userId = String(ctx.from?.id);
    this.uploadStates.delete(userId);
    await this.handleListDocuments(ctx, workerId);
  }
}
