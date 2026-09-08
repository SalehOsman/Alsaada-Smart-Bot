import { InlineKeyboard } from 'grammy';
import { buildCompletionKeyboard } from '@alsaada/core-components';
import { FIELD_LABELS, FIELD_TO_SHORT_MAP } from './flow.validators.js';
import type { EditableWorkerField, PendingEditTicket } from './flow.types.js';

export class WorkerEditKeyboards {
  static fieldsSelectionKeyboard(workerId: string): InlineKeyboard {
    const kb = new InlineKeyboard();
    const fields = Object.keys(FIELD_LABELS) as EditableWorkerField[];

    for (let i = 0; i < fields.length; i += 2) {
      const f1 = fields[i];
      const f2 = fields[i + 1];
      if (f1) {
        const short1 = FIELD_TO_SHORT_MAP[f1];
        kb.text(FIELD_LABELS[f1], `action:w_edit:f:${short1}:${workerId}`);
      }
      if (f2) {
        const short2 = FIELD_TO_SHORT_MAP[f2];
        kb.text(FIELD_LABELS[f2], `action:w_edit:f:${short2}:${workerId}`);
      }
      kb.row();
    }

    kb.text('◀️ رجوع لدليل العاملين', 'action:worker:directory').row();
    kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
    return kb;
  }

  static cancelEditKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('❌ إلغاء التعديل', 'action:w_edit:cancel')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');
  }

  static ticketReviewKeyboard(ticketId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ اعتماد وتطبيق فوري', `action:w_edit:appr:${ticketId}`)
      .row()
      .text('❌ رفض الطلب', `action:w_edit:rejc:${ticketId}`)
      .row()
      .text('◀️ رجوع لقائمة الطلبات', 'action:worker_edit:pending_list')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');
  }

  static pendingTicketsListKeyboard(tickets: PendingEditTicket[]): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (const t of tickets) {
      kb.text(`📝 ${t.workerName} - ${t.fieldName}`, `action:w_edit:rev:${t.requestId}`).row();
    }
    kb.text('◀️ رجوع لشؤون العاملين', 'menu:hr_sub:onboarding').row();
    kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
    return kb;
  }

  static directEditSuccessKeyboard(): InlineKeyboard {
    return buildCompletionKeyboard({
      repeatButtonText: '✏️ تعديل عامل آخر',
      repeatCallbackData: 'action:worker_edit:pick',
      sectionButtonText: '🔙 العودة لشؤون العاملين',
      sectionCallbackData: 'menu:hr_sub:onboarding',
      mainMenuCallbackData: 'action:main_menu',
    });
  }
}
