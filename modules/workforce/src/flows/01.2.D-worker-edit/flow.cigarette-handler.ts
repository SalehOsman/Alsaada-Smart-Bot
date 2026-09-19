import type { Context, InlineKeyboard } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerEditService } from './flow.service.js';
import { WorkerEditRepository } from './flow.repository.js';
import { WorkerEditMessages } from './flow.messages.js';
import { WorkerEditKeyboards, POLICY_SHORT_TO_CODE } from './flow.keyboard.js';
import type { PendingWorkerEditState } from './flow.types.js';
import type { ReplyOrEditFn, PickWorkerFn } from './flow.salary-wizard.js';
import type { WorkerEditDraftStore } from './flow.draft-store.js';

export class WorkerCigaretteHandler {
  constructor(
    private readonly service: WorkerEditService,
    private readonly repository: WorkerEditRepository,
    private readonly replyOrEdit: ReplyOrEditFn,
    private readonly pickWorker: PickWorkerFn,
    private readonly editDrafts: WorkerEditDraftStore | Map<string, PendingWorkerEditState>,
    private readonly isSuperAdmin: (ctx: WorkforceModuleContext) => boolean
  ) {}

  async handleCigaretteStart(ctx: WorkforceModuleContext, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!this.isSuperAdmin(ctx)) {
      await this.replyOrEdit(ctx, '⛔ تعديل مخصص السجائر مخصص حصرياً للمدير العام.');
      return;
    }
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل.');
      return;
    }
    const text = WorkerEditMessages.selectCigarettePolicyPrompt(worker.name, worker.canteenCigarettePolicy);
    const kb = WorkerEditKeyboards.cigarettePolicyKeyboard(workerId);
    await this.replyOrEdit(ctx, text, kb);
  }

  async handleCigaretteSelectPolicy(ctx: WorkforceModuleContext, pShort: string, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const policy = POLICY_SHORT_TO_CODE[pShort] || pShort;
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل.');
      return;
    }
    const actorId = ctx.from ? BigInt(ctx.from.id) : BigInt(0);
    if (policy === 'NONE') {
      await this.service.applyCigaretteAllocation(workerId, 'NONE', null, null, actorId);
      await this.pickWorker(ctx, workerId, 'FINANCE');
      return;
    }
    if (ctx.from) {
      this.editDrafts.set(String(ctx.from.id), {
        workerId,
        workerCode: worker.code,
        workerName: worker.name,
        selectedPolicy: policy,
        step: 'SELECT_BRAND',
        isSuperAdmin: this.isSuperAdmin(ctx),
      });
    }
    const items = await this.service.getCigaretteItems(worker.siteId || undefined);
    const text = WorkerEditMessages.selectCigaretteBrandPrompt(worker.name, policy);
    const kb = WorkerEditKeyboards.cigaretteBrandKeyboard(workerId, items);
    await this.replyOrEdit(ctx, text, kb);
  }

  async handleCigaretteSelectBrand(ctx: WorkforceModuleContext, idxStr: string, workerId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const worker = await this.repository.findWorkerForEdit(workerId);
    if (!worker) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على العامل.');
      return;
    }
    const draft = ctx.from ? this.editDrafts.get(String(ctx.from.id)) : undefined;
    const policy = draft?.selectedPolicy || 'ONE_PACK_DAILY';
    const items = await this.service.getCigaretteItems(worker.siteId || undefined);
    const item = items[parseInt(idxStr, 10)];
    const actorId = ctx.from ? BigInt(ctx.from.id) : BigInt(0);
    if (item) {
      await this.service.applyCigaretteAllocation(workerId, policy, item.name, item.id, actorId);
    }
    if (ctx.from) this.editDrafts.delete(String(ctx.from.id));
    await this.pickWorker(ctx, workerId, 'FINANCE');
  }
}
