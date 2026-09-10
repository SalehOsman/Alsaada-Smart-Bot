import { InputFile } from 'grammy';
import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { JobMatrixService } from './flow.service.js';
import {
  buildDepartmentsListKeyboard,
  buildDepartmentDetailKeyboard,
  buildJobDetailKeyboard,
  buildCyclePresetsKeyboard,
} from './flow.keyboard.js';
import {
  formatDepartmentsListCard,
  formatDepartmentDetailCard,
  formatJobDetailCard,
  formatCyclePresetsPrompt,
} from './flow.messages.js';

export class JobMatrixHandler {
  constructor(private readonly service: JobMatrixService) {}

  async renderDepartmentsHub(ctx: SettingsModuleContext, inPlace = false, noticeText?: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: '🔒 مخصص حصرياً للمدير العام.', show_alert: true }).catch(() => {});
      } else {
        await ctx.reply('🔒 مخصص حصرياً للمدير العام.');
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const depts = await this.service.listDepartments();
    const keyboard = buildDepartmentsListKeyboard(depts, ctx.isImpersonating);
    const text = formatDepartmentsListCard(depts, noticeText);

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

  async renderDepartmentDetail(ctx: SettingsModuleContext, deptCode: string, inPlace = false, noticeText?: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const full = await this.service.getDepartmentWithJobs(deptCode);
    if (!full) {
      await this.renderDepartmentsHub(ctx, inPlace, '❌ القسم المطلوب غير مسجل.');
      return;
    }

    const keyboard = buildDepartmentDetailKeyboard(full.dept, full.jobs, ctx.isImpersonating);
    const text = formatDepartmentDetailCard(full.dept, full.jobs, noticeText);

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

  async renderJobDetail(ctx: SettingsModuleContext, deptCode: string, jobCode: string, inPlace = false, noticeText?: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) {
      await this.renderDepartmentDetail(ctx, deptCode, inPlace, '❌ الوظيفة المطلوبة غير مسجلة.');
      return;
    }

    const keyboard = buildJobDetailKeyboard(job, ctx.isImpersonating);
    const text = formatJobDetailCard(job, noticeText);

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

  async handleHeadcountDelta(ctx: SettingsModuleContext, deptCode: string, jobCode: string, delta: 'inc' | 'dec'): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return;

    const change = delta === 'inc' ? 1 : -1;
    const updated = await this.service.updateHeadcountDelta(job.id, change);
    await this.renderJobDetail(ctx, deptCode, jobCode, true, `تم تحديث حد الكفاية إلى (${updated.minHeadcount})`);
  }

  async handleToggleJob(ctx: SettingsModuleContext, deptCode: string, jobCode: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return;

    const updated = await this.service.toggleJobActive(job.id);
    const msg = updated.isActive ? 'تم تنشيط المهنة بنجاح.' : 'تم تجميد المهنة مؤقتاً.';
    await this.renderJobDetail(ctx, deptCode, jobCode, true, msg);
  }

  async handleToggleDept(ctx: SettingsModuleContext, deptCode: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    const full = await this.service.getDepartmentWithJobs(deptCode);
    if (!full) return;

    const isActive = await this.service.toggleDeptActive(full.dept.id);
    const msg = isActive ? 'تم تنشيط القسم بنجاح.' : 'تم تجميد القسم مؤقتاً.';
    await this.renderDepartmentDetail(ctx, deptCode, true, msg);
  }

  async handlePromptEditCycle(ctx: SettingsModuleContext, deptCode: string, jobCode: string): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return;

    const keyboard = buildCyclePresetsKeyboard(deptCode, jobCode);
    const text = formatCyclePresetsPrompt(job);

    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }).catch(() => ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard }));
  }

  async handleQuickPreset(ctx: SettingsModuleContext, deptCode: string, jobCode: string, workDays: number, restDays: number): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    const job = await this.service.getJob(deptCode, jobCode);
    if (!job) return;

    await this.service.updateJobCycle(job.id, workDays, restDays);
    await this.renderJobDetail(ctx, deptCode, jobCode, true, `✅ تم تعيين دورة العمل بنجاح: (${workDays} عمل / ${restDays} إجازة)`);
  }

  async handleDownloadExcel(ctx: SettingsModuleContext): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

    const buffer = await this.service.generateExcelTemplate();
    const inputFile = new InputFile(buffer, 'AlSaada_Job_Matrix_Template.xlsx');

    await ctx.replyWithDocument(inputFile, {
      caption: '📊 *قالب مصفوفة الأقسام والوظائف الرسمي*\nيمكنك تعبئة بيانات المهن وتحديثها ثم إعادة رفع الملف هنا.',
      parse_mode: 'Markdown',
    });
  }
}
