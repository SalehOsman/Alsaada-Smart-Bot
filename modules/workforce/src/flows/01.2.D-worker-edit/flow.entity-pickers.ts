import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerEditService } from './flow.service.js';
import { WorkerEditKeyboards } from './flow.keyboard.js';
import type { ReplyOrEditFn, PickWorkerFn } from './flow.salary-wizard.js';

export class WorkerEntityPickersHandler {
  constructor(
    private readonly service: WorkerEditService,
    private readonly replyOrEdit: ReplyOrEditFn,
    private readonly pickWorker: PickWorkerFn,
    private readonly isSuperAdmin?: (ctx: WorkforceModuleContext) => boolean
  ) {}

  async handleOpenJobPicker(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (this.isSuperAdmin && !this.isSuperAdmin(ctx)) {
      await this.replyOrEdit(ctx, '⛔ تعديل هذا البيان مخصص حصرياً للمدير العام.');
      return;
    }
    const jobs = await this.service.getAllJobTitles();
    const kb = WorkerEditKeyboards.entityPickerKeyboard(jobs, 'set_job', workerId, 'JOB');
    await this.replyOrEdit(ctx, '💼 *اختر المسمى الوظيفي الجديد للعامل:*', kb);
  }

  async handleSetJob(ctx: WorkforceModuleContext, jobId: string, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (this.isSuperAdmin && !this.isSuperAdmin(ctx)) {
      await this.replyOrEdit(ctx, '⛔ تعديل هذا البيان مخصص حصرياً للمدير العام.');
      return;
    }
    const actorId = ctx.from ? BigInt(ctx.from.id) : BigInt(0);
    const actorName = ctx.from?.first_name || 'المدير العام';
    await this.service.applyDirectEdit(workerId, 'jobTitleId', jobId, actorId, actorName);
    await this.pickWorker(ctx, workerId, 'JOB');
  }


  async handleOpenSitePicker(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (this.isSuperAdmin && !this.isSuperAdmin(ctx)) {
      await this.replyOrEdit(ctx, '⛔ تعديل هذا البيان مخصص حصرياً للمدير العام.');
      return;
    }
    const sites = await this.service.getAllSites();
    const kb = WorkerEditKeyboards.entityPickerKeyboard(sites, 'set_site', workerId, 'JOB');
    await this.replyOrEdit(ctx, '📍 *اختر الموقع الميداني الجديد للعمليات:*', kb);
  }

  async handleSetSite(ctx: WorkforceModuleContext, siteId: string, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (this.isSuperAdmin && !this.isSuperAdmin(ctx)) {
      await this.replyOrEdit(ctx, '⛔ تعديل هذا البيان مخصص حصرياً للمدير العام.');
      return;
    }
    const actorId = ctx.from ? BigInt(ctx.from.id) : BigInt(0);
    const actorName = ctx.from?.first_name || 'المدير العام';
    await this.service.applyDirectEdit(workerId, 'siteId', siteId, actorId, actorName);
    await this.pickWorker(ctx, workerId, 'JOB');
  }

  async handleOpenDeptPicker(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (this.isSuperAdmin && !this.isSuperAdmin(ctx)) {
      await this.replyOrEdit(ctx, '⛔ تعديل هذا البيان مخصص حصرياً للمدير العام.');
      return;
    }
    const depts = await this.service.getAllDepartments();
    const kb = WorkerEditKeyboards.entityPickerKeyboard(depts, 'set_dept', workerId, 'JOB');
    await this.replyOrEdit(ctx, '🏢 *اختر الإدارة أو القسم الجديد:*', kb);
  }

  async handleSetDept(ctx: WorkforceModuleContext, deptId: string, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (this.isSuperAdmin && !this.isSuperAdmin(ctx)) {
      await this.replyOrEdit(ctx, '⛔ تعديل هذا البيان مخصص حصرياً للمدير العام.');
      return;
    }
    const actorId = ctx.from ? BigInt(ctx.from.id) : BigInt(0);
    const actorName = ctx.from?.first_name || 'المدير العام';
    await this.service.applyDirectEdit(workerId, 'departmentId', deptId, actorId, actorName);
    await this.pickWorker(ctx, workerId, 'JOB');
  }
}

