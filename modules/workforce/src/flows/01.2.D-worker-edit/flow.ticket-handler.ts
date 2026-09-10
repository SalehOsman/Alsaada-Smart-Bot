import type { Context, InlineKeyboard } from 'grammy';
import type { WorkforceModuleContext } from '../../shared/module.types.js';
import { WorkerEditService } from './flow.service.js';
import { WorkerEditMessages } from './flow.messages.js';
import { WorkerEditKeyboards } from './flow.keyboard.js';
import type { ReplyOrEditFn } from './flow.salary-wizard.js';

export class WorkerTicketHandler {
  constructor(
    private readonly service: WorkerEditService,
    private readonly replyOrEdit: ReplyOrEditFn,
    private readonly isSuperAdmin: (ctx: WorkforceModuleContext) => boolean
  ) {}

  async handlePendingTicketsList(ctx: WorkforceModuleContext): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!this.isSuperAdmin(ctx)) {
      await this.replyOrEdit(ctx, '⛔ هذه الشاشة حصرية للمدير العام.');
      return;
    }
    const tickets = await this.service.listPendingTickets();
    if (tickets.length === 0) {
      await this.replyOrEdit(ctx, '✅ لا توجد أي طلبات تعديل معلقة حالياً.');
      return;
    }
    const text = WorkerEditMessages.pendingTicketsHeader(tickets.length);
    await this.replyOrEdit(ctx, text, WorkerEditKeyboards.pendingTicketsListKeyboard(tickets));
  }

  async handleReviewTicket(ctx: WorkforceModuleContext, ticketId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const tickets = await this.service.listPendingTickets();
    const ticket = tickets.find((t) => t.requestId === ticketId);
    if (!ticket) {
      await this.replyOrEdit(ctx, '⚠️ لم يتم العثور على الطلب المطلوب أو تم البت فيه مسبقاً.');
      return;
    }
    await this.replyOrEdit(ctx, WorkerEditMessages.reviewTicketCard(ticket), WorkerEditKeyboards.ticketReviewKeyboard(ticket.requestId));
  }

  async handleApproveTicket(ctx: WorkforceModuleContext, ticketId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const result = await this.service.approveTicket(ticketId, BigInt(ctx.from.id));
    const msg = result.success
      ? `✅ تم اعتماد وتطبيق التعديل للطلب \`${ticketId}\` فورياً بنجاح.`
      : `❌ تعذر اعتماد الطلب: ${result.error}`;
    await this.replyOrEdit(ctx, msg);
  }

  async handleRejectTicket(ctx: WorkforceModuleContext, ticketId: string): Promise<void> {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    if (!ctx.from) return;
    const result = await this.service.rejectTicket(ticketId, BigInt(ctx.from.id));
    const msg = result.success
      ? `❌ تم رفض طلب التعديل \`${ticketId}\`.`
      : `❌ تعذر رفض الطلب: ${result.error}`;
    await this.replyOrEdit(ctx, msg);
  }
}
