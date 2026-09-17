import { InputFile, type InlineKeyboard } from 'grammy';
import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { JobMatrixService } from './flow.service.js';
import {
  buildDepartmentsListKeyboard,
  buildDepartmentDetailKeyboard,
  buildJobDetailKeyboard,
  buildCyclePresetsKeyboard,
  buildSalaryPolicyKeyboard,
  buildCyclePolicyKeyboard,
  buildCancelEditKeyboard,
  buildUploadPromptKeyboard,
  buildUploadResultKeyboard,
} from './flow.keyboard.js';
import {
  formatDepartmentsListCard,
  formatDepartmentDetailCard,
  formatJobDetailCard,
  formatCyclePresetsPrompt,
  formatSalaryPrompt,
  formatSalaryPolicyPrompt,
  formatCyclePolicyPrompt,
  formatUploadPromptCard,
  formatUploadResultCard,
} from './flow.messages.js';
import { formatCurrency, normalizeDigits } from '@alsaada/regional-engine';

export class JobMatrixHandler {
  private readonly pendingUploads = new Set<string>();

  constructor(private readonly service: JobMatrixService) {}

  isWaitingForUpload(userId: string): boolean {
    return this.pendingUploads.has(userId);
  }

  private isSuperAdmin(ctx: SettingsModuleContext): boolean {
    return Boolean(ctx.isRealSuperAdmin || ctx.effectiveRole === 'SUPER_ADMIN');
  }

  private async sendOrEdit(ctx: SettingsModuleContext, text: string, keyboard?: InlineKeyboard, inPlace = false): Promise<void> {
    const opts = keyboard ? { parse_mode: 'Markdown' as const, reply_markup: keyboard } : { parse_mode: 'Markdown' as const };
    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, opts);
        return;
      } catch {}
    }
    await ctx.reply(text, opts);
  }

  async renderDepartmentsHub(ctx: SettingsModuleContext, inPlace = false, noticeText?: string): Promise<void> {
    if (!this.isSuperAdmin(ctx)) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: '🔒 مخصص حصرياً للمدير العام.', show_alert: true }).catch(() => {});
      else await ctx.reply('🔒 مخصص حصرياً للمدير العام.');
      return;
    }
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const depts = await this.service.listDepartments();
    await this.sendOrEdit(ctx, formatDepartmentsListCard(depts, noticeText), buildDepartmentsListKeyboard(depts, ctx.isImpersonating), inPlace);
  }

  async renderDepartmentDetail(ctx: SettingsModuleContext, deptCode: string, inPlace = false, noticeText?: string): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const full = await this.service.getDepartmentWithJobs(deptCode);
    if (!full) return this.renderDepartmentsHub(ctx, inPlace, '❌ القسم المطلوب غير مسجل.');
    await this.sendOrEdit(ctx, formatDepartmentDetailCard(full.dept, full.jobs, noticeText), buildDepartmentDetailKeyboard(full.dept, full.jobs, ctx.isImpersonating), inPlace);
  }

  async renderJobDetail(ctx: SettingsModuleContext, deptCode: string, jobCode: string, inPlace = false, noticeText?: string): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return this.renderDepartmentDetail(ctx, deptCode, inPlace, '❌ الوظيفة المطلوبة غير مسجلة.');
    await this.sendOrEdit(ctx, formatJobDetailCard(job, noticeText), buildJobDetailKeyboard(job, ctx.isImpersonating), inPlace);
  }

  async handleHeadcountDelta(ctx: SettingsModuleContext, deptCode: string, jobCode: string, delta: 'inc' | 'dec'): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return;
    const updated = await this.service.updateHeadcountDelta(job.id, delta === 'inc' ? 1 : -1);
    await this.renderJobDetail(ctx, deptCode, jobCode, true, `تم تحديث حد الكفاية إلى (${updated.minHeadcount})`);
  }

  async handleToggleJob(ctx: SettingsModuleContext, deptCode: string, jobCode: string): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return;
    const updated = await this.service.toggleJobActive(job.id);
    await this.renderJobDetail(ctx, deptCode, jobCode, true, updated.isActive ? 'تم تنشيط المهنة بنجاح.' : 'تم تجميد المهنة مؤقتاً.');
  }

  async handleToggleDept(ctx: SettingsModuleContext, deptCode: string): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    const full = await this.service.getDepartmentWithJobs(deptCode);
    if (!full) return;
    const isActive = await this.service.toggleDeptActive(full.dept.id);
    await this.renderDepartmentDetail(ctx, deptCode, true, isActive ? 'تم تنشيط القسم بنجاح.' : 'تم تجميد القسم مؤقتاً.');
  }

  // --- Salary Editing & Transition Policies ---

  async handlePromptEditSalary(ctx: SettingsModuleContext, deptCode: string, jobCode: string, field: 'base' | 'add'): Promise<void> {
    if (!this.isSuperAdmin(ctx) || !ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return;

    this.service.setPendingEdit(ctx.from.id, {
      type: field === 'base' ? 'JOB_SALARY' : 'JOB_ADDITIONAL_SALARY',
      deptCode, jobCode,
      promptMessageId: ctx.callbackQuery?.message?.message_id,
      timestamp: Date.now(),
    });
    await this.sendOrEdit(ctx, formatSalaryPrompt(job, field), buildCancelEditKeyboard(deptCode, jobCode), Boolean(ctx.callbackQuery));
  }

  async handleSalaryPolicy(
    ctx: SettingsModuleContext,
    deptCode: string,
    jobCode: string,
    field: 'base' | 'add',
    amount: number,
    scope: 'NEW_HIRES_ONLY' | 'ALL_ACTIVE_WORKERS'
  ): Promise<void> {
    if (!this.isSuperAdmin(ctx) || !ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return;

    const adminId = BigInt(ctx.from.id);
    const result = field === 'base'
      ? await this.service.updateJobBaseSalaryWithPolicy(job.id, amount, scope, adminId)
      : await this.service.updateJobAdditionalSalaryWithPolicy(job.id, amount, scope, adminId);

    if (scope === 'ALL_ACTIVE_WORKERS' && ctx.api) {
      const fieldLabel = field === 'base' ? 'الراتب الأساسي' : 'الراتب الإضافي';
      for (const worker of result.affectedWorkers) {
        if (worker.telegramId) {
          await ctx.api.sendMessage(
            Number(worker.telegramId),
            `📢 *إشعار تعديل الأجور*\nعزيزي العامل: *${worker.name}*\nتم تعديل ${fieldLabel} لمهنتكم (*${result.job.title}*) إلى \`${formatCurrency(amount)}\`.\n• إجمالي الراتب الجديد: \`${formatCurrency(result.job.baseSalary + result.job.allowance)}\``,
            { parse_mode: 'Markdown' }
          ).catch(() => {});
        }
      }
    }

    const fieldLabel = field === 'base' ? 'الراتب الأساسي' : 'الراتب الإضافي';
    const scopeMsg = scope === 'ALL_ACTIVE_WORKERS' ? `تطبيق شامل على جميع العاملين (${result.affectedWorkers.length} عامل)` : 'المعينون الجدد فقط';
    await this.renderJobDetail(ctx, deptCode, jobCode, true, `✅ تم تحديث ${fieldLabel} إلى ${formatCurrency(amount)} بنجاح [${scopeMsg}]`);
  }

  // --- Shift Cycle Editing & Transition Policies ---

  async handlePromptEditCycle(ctx: SettingsModuleContext, deptCode: string, jobCode: string): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return;
    const cycles = await this.service.listDistinctShiftCycles();
    await this.sendOrEdit(ctx, formatCyclePresetsPrompt(job), buildCyclePresetsKeyboard(deptCode, jobCode, cycles), true);
  }

  async handlePromptCustomCycle(ctx: SettingsModuleContext, deptCode: string, jobCode: string): Promise<void> {
    if (!this.isSuperAdmin(ctx) || !ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return;
    this.service.setPendingEdit(ctx.from.id, { type: 'SET_WD', deptCode, jobCode });
    const text = `✍️ *إدخال دورة عمل مخصصة للمهنة*\n• المهنة: *${job.title}*\n\nيرجى إدخال *عدد أيام العمل* (رقم صحيح بين 1 و 60 يوماً):`;
    await this.sendOrEdit(ctx, text, buildCancelEditKeyboard(deptCode, jobCode), Boolean(ctx.callbackQuery));
  }

  async handleCycleChoice(ctx: SettingsModuleContext, deptCode: string, jobCode: string, workDays: number, restDays: number): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return;
    await this.sendOrEdit(ctx, formatCyclePolicyPrompt(job, workDays, restDays), buildCyclePolicyKeyboard(deptCode, jobCode, workDays, restDays), true);
  }

  async handleCyclePolicy(
    ctx: SettingsModuleContext,
    deptCode: string,
    jobCode: string,
    workDays: number,
    restDays: number,
    policy: 'NEW_HIRES_ONLY' | 'NEXT_CYCLE'
  ): Promise<void> {
    if (!this.isSuperAdmin(ctx) || !ctx.from) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return;
    const result = await this.service.updateJobCycleWithPolicy(job.id, workDays, restDays, policy, BigInt(ctx.from.id));
    const policyMsg = policy === 'NEXT_CYCLE' ? `تطبيق على العاملين مع الدورة القادمة (${result.affectedWorkersCount} عامل)` : 'المعينون الجدد فقط';
    await this.renderJobDetail(ctx, deptCode, jobCode, true, `✅ تم تحديث دورة العمل (${workDays} عمل / ${restDays} إجازة) بنجاح [${policyMsg}]`);
  }

  async handleQuickPreset(ctx: SettingsModuleContext, deptCode: string, jobCode: string, workDays: number, restDays: number): Promise<void> {
    return this.handleCycleChoice(ctx, deptCode, jobCode, workDays, restDays);
  }

  // --- Text Input Handling ---

  async handleTextInput(ctx: SettingsModuleContext): Promise<boolean> {
    if (!ctx.from || !ctx.message?.text) return false;
    const pending = this.service.getPendingEdit(ctx.from.id);
    if (!pending || !pending.deptCode || !pending.jobCode) return false;

    // Handle custom workDays input
    if (pending.type === 'SET_WD') {
      const wd = parseInt(normalizeDigits(ctx.message.text.trim()), 10);
      if (isNaN(wd) || wd < 1 || wd > 60) {
        await ctx.reply('⚠️ يرجى إدخال عدد أيام عمل صحيح بين 1 و 60 يوماً.');
        return true;
      }
      await ctx.deleteMessage().catch(() => {});
      this.service.setPendingEdit(ctx.from.id, {
        type: 'SET_RD',
        deptCode: pending.deptCode,
        jobCode: pending.jobCode,
        pendingAmount: wd,
      });
      const prompt = `🌴 *عدد أيام الإجازة والراحة*\nتم تسجيل أيام العمل: *${wd} يوماً*.\n\nيرجى الآن إدخال *عدد أيام الإجازة* (رقم صحيح بين 0 و 30 يوماً):`;
      await ctx.reply(prompt, {
        parse_mode: 'Markdown',
        reply_markup: buildCancelEditKeyboard(pending.deptCode, pending.jobCode),
      });
      return true;
    }

    // Handle custom restDays input
    if (pending.type === 'SET_RD') {
      const rd = parseInt(normalizeDigits(ctx.message.text.trim()), 10);
      if (isNaN(rd) || rd < 0 || rd > 30) {
        await ctx.reply('⚠️ يرجى إدخال عدد أيام إجازة صحيح بين 0 و 30 يوماً.');
        return true;
      }
      await ctx.deleteMessage().catch(() => {});
      const wd = pending.pendingAmount || 20;
      this.service.clearPendingEdit(ctx.from.id);
      const job = await this.service.getJob(pending.deptCode, pending.jobCode);
      if (!job) {
        await ctx.reply('❌ تعذر العثور على بيانات المهنة.');
        return true;
      }
      await ctx.reply(formatCyclePolicyPrompt(job, wd, rd), {
        parse_mode: 'Markdown',
        reply_markup: buildCyclePolicyKeyboard(pending.deptCode, pending.jobCode, wd, rd),
      });
      return true;
    }

    if (pending.type !== 'JOB_SALARY' && pending.type !== 'JOB_ADDITIONAL_SALARY') return false;

    const parsed = parseFloat(normalizeDigits(ctx.message.text.trim()).replace(/[^0-9.]/g, ''));
    if (isNaN(parsed) || parsed < 0) {
      await ctx.reply('⚠️ يرجى إدخال مبلغ صحيح بالأرقام (مثال: 7000 أو 2000).');
      return true;
    }

    await ctx.deleteMessage().catch(() => {});
    this.service.clearPendingEdit(ctx.from.id);
    const job = await this.service.getJob(pending.deptCode, pending.jobCode);
    if (!job) {
      await ctx.reply('❌ تعذر العثور على بيانات المهنة.');
      return true;
    }

    const field = pending.type === 'JOB_SALARY' ? 'base' : 'add';
    await ctx.reply(formatSalaryPolicyPrompt(job, field, parsed), {
      parse_mode: 'Markdown',
      reply_markup: buildSalaryPolicyKeyboard(pending.deptCode, pending.jobCode, field, parsed),
    });
    return true;
  }

  // --- Excel Import / Export ---

  async handleDownloadExcel(ctx: SettingsModuleContext): Promise<void> {
    if (!this.isSuperAdmin(ctx)) return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const buffer = await this.service.generateExcelTemplate();
    await ctx.replyWithDocument(new InputFile(buffer, 'AlSaada_Job_Matrix_Template.xlsx'), {
      caption: '📊 *قالب مصفوفة الأقسام والوظائف الرسمي المحدث*\nيتضمن عمود «الراتب الإضافي» ودورات العمل المعيارية.',
      parse_mode: 'Markdown',
    });
  }

  async handleStartUpload(ctx: SettingsModuleContext): Promise<void> {
    if (!this.isSuperAdmin(ctx)) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: '🔒 مخصص حصرياً للمدير العام.', show_alert: true }).catch(() => {});
      else await ctx.reply('🔒 مخصص حصرياً للمدير العام.');
      return;
    }
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.from) this.pendingUploads.add(String(ctx.from.id));
    await this.sendOrEdit(ctx, formatUploadPromptCard(), buildUploadPromptKeyboard(), Boolean(ctx.callbackQuery));
  }

  async handleCancelUpload(ctx: SettingsModuleContext): Promise<void> {
    if (ctx.from) this.pendingUploads.delete(String(ctx.from.id));
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'تم الإلغاء.' }).catch(() => {});
    await this.renderDepartmentsHub(ctx, true, 'تم إلغاء رفع مصفوفة إكسيل.');
  }

  async handleDocumentUpload(ctx: SettingsModuleContext, fileBuffer: Buffer): Promise<void> {
    if (ctx.from) this.pendingUploads.delete(String(ctx.from.id));
    if (!this.isSuperAdmin(ctx)) return (void ctx.reply('🔒 مخصص حصرياً للمدير العام.'));
    if (typeof ctx.replyWithChatAction === 'function') await ctx.replyWithChatAction('typing').catch(() => {});
    const result = await this.service.parseAndImportExcel(fileBuffer);
    await ctx.reply(formatUploadResultCard(result), { parse_mode: 'Markdown', reply_markup: buildUploadResultKeyboard() });
  }
}
