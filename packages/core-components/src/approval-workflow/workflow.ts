import { InlineKeyboard } from 'grammy';
import type { ApprovalTicket, ApprovalDecisionInput, ApprovalDecisionResult, ApprovalStatus } from './types.js';

export class UniversalApprovalWorkflow {
  /**
   * 🎴 تصيير بطاقة دورة الاعتماد الهرمية مع أزرار القرار
   */
  static buildApprovalCard(ticket: ApprovalTicket): { text: string; keyboard: InlineKeyboard } {
    const text =
      `📑 *طلب اعتماد رسمي — [${ticket.domain}]*\n` +
      `────────────────────────────\n` +
      `🔖 رقم الطلب: \`${ticket.requestId}\`\n` +
      `👤 مقدّم الطلب: *${ticket.requesterName}* (${ticket.requesterRole})\n` +
      (ticket.targetWorkerName ? `👷 العامل المعني: *${ticket.targetWorkerName}* (${ticket.targetWorkerCode})\n` : '') +
      `📌 التفاصيل / القيمة: *${ticket.amountOrDetails}*\n` +
      `📝 البيان / السبب: *${ticket.reason}*\n` +
      `⏳ الحالة الحالية: *${ticket.currentStatus}*\n`;

    const kb = new InlineKeyboard()
      .text('✅ موافقة واعتماد', `action:appr:do:${ticket.requestId}:ok`)
      .text('❌ رفض الطلب', `action:appr:do:${ticket.requestId}:no`)
      .row()
      .text('📋 سجل قرارات الاعتماد', `action:appr:hist:${ticket.requestId}`);

    return { text, keyboard: kb };
  }

  /**
   * ⚖️ معالجة قرار الاعتماد ونقل الحالة وفق السلم الإداري
   */
  static processDecision(input: ApprovalDecisionInput): ApprovalDecisionResult {
    const { ticket, actorName, actorRole, decision, rejectionReason } = input;

    if (ticket.currentStatus === 'APPROVED' || ticket.currentStatus === 'REJECTED') {
      return {
        success: false,
        newStatus: ticket.currentStatus,
        isFullyApproved: ticket.currentStatus === 'APPROVED',
        isRejected: ticket.currentStatus === 'REJECTED',
        messageArabic: '⚠️ هذا الطلب تمت معالجته والبت فيه مسبقاً.',
        errorArabic: 'ALREADY_PROCESSED',
      };
    }

    if (decision === 'REJECT') {
      return {
        success: true,
        newStatus: 'REJECTED',
        isFullyApproved: false,
        isRejected: true,
        messageArabic: `❌ تم رفض الطلب (${ticket.requestId}) بواسطة ${actorName} (${actorRole}).${rejectionReason ? ` السبب: ${rejectionReason}` : ''}`,
      };
    }

    // تسلسل هرمي للموافقة
    let nextStatus: ApprovalStatus = 'APPROVED';
    if (ticket.currentStatus === 'PENDING_SUPERVISOR') {
      nextStatus = 'PENDING_PROJECT_MANAGER';
    } else if (ticket.currentStatus === 'PENDING_PROJECT_MANAGER') {
      nextStatus = 'PENDING_HR';
    } else if (ticket.currentStatus === 'PENDING_HR') {
      nextStatus = 'APPROVED';
    }

    const isFullyApproved = nextStatus === 'APPROVED';

    return {
      success: true,
      newStatus: nextStatus,
      isFullyApproved,
      isRejected: false,
      messageArabic: isFullyApproved
        ? `✅ تم الاعتماد النهائي للطلب (${ticket.requestId}) بواسطة ${actorName} (${actorRole}).`
        : `✅ تم تأييد الطلب ونقله للمستوى الإداري التالي (${nextStatus}).`,
    };
  }
}
