import { InlineKeyboard } from 'grammy';
import type { TerminationReason } from './flow.types.js';
import { TERMINATION_REASON_LABELS } from './flow.types.js';

export function buildWorkerPickerKeyboard(workers: Array<{ id: string; name: string; code: string }>): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const w of workers) {
    kb.text(`${w.name} (#${w.code})`, `action:wob:pick:${w.id}`).row();
  }
  kb.text('🔙 إلغاء والعودة للرئيسية', 'action:wob:cancel');
  return kb;
}

export function buildReasonKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  const reasons = Object.keys(TERMINATION_REASON_LABELS) as TerminationReason[];

  for (const r of reasons) {
    kb.text(TERMINATION_REASON_LABELS[r], `action:wob:r:${r}`).row();
  }
  kb.text('🔙 إلغاء', 'action:wob:cancel');
  return kb;
}

export function buildConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🚨 تأكيد إنهاء الخدمة والمخالصة', 'action:wob:confirm')
    .row()
    .text('❌ تراجع وإلغاء', 'action:wob:cancel');
}

export function buildSuccessKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('👥 دليل العاملين', 'action:workforce:directory')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}
