/**
 * Telegram Keyboard & Message Builders for Flow 99.2 (sandbox-calc)
 * Enforces Telegram Ergonomics Budget (36/16/7/3) & Sovereign Rich Message Standards
 */

import {
  buildRichPage,
  buildRichTable,
  buildRichConfirmation,
  assertRichMessage,
  richParagraph,
} from '@alsaada/core-components';
import type { MaskedFinancialRecordDTO } from './types.js';

export type InputRichMessage = ReturnType<typeof buildRichPage>;

export function buildSandboxCalcMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🧮 حساب الراتب', callback_data: 'action:sandbox:sandbox-calc:net' },
        { text: '🔒 فحص القناع', callback_data: 'action:sandbox:sandbox-calc:mask' },
      ],
      [
        { text: '🔙 رجوع للمختبر', callback_data: 'action:sandbox:main' },
      ],
    ],
  };
}

export function buildSandboxCalcConfirmKeyboard(referenceId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ تأكيد', callback_data: 'action:sandbox:sandbox-calc:confirm:' + referenceId },
        { text: '❌ إلغاء', callback_data: 'action:sandbox:sandbox-calc:cancel' },
      ],
    ],
  };
}

export function formatSandboxCalcPrompt(titleArabic: string): string {
  return `📌 *${titleArabic}*\n\nيرجى تحديد العملية الحسابية أو فحص حجب البيانات المالية:`;
}

export function buildSandboxCalcPromptMessage(titleArabic: string): InputRichMessage {
  const msg = buildRichPage({
    title: `🧪 ${titleArabic}`,
    blocks: [
      richParagraph('مختبر العمليات الحسابية والقناع المالي لمطابقة معايير الحماية والرواتب.'),
    ],
  });
  assertRichMessage(msg);
  return msg;
}

export function buildSandboxCalcResultTable(masked: MaskedFinancialRecordDTO): InputRichMessage {
  const table = buildRichTable({
    headers: ['البند المالي', 'القيمة المقدرة'],
    rows: [
      ['الراتب الأساسي', masked.basicSalary],
      ['البدلات والمكافآت', masked.allowances],
      ['الاستقطاعات', masked.deductions],
      ['صافي المستحق', masked.netPay],
    ],
  });

  const msg = buildRichPage({
    title: '📊 كشف المستحقات المالية',
    blocks: [table],
  });
  assertRichMessage(msg);
  return msg;
}

export function buildSandboxCalcConfirmMessage(referenceId: string): InputRichMessage {
  const msg = buildRichConfirmation({
    question: `تأكيد تنفيذ عملية الحساب والقناع المالي (${referenceId})؟`,
    confirmCallback: `action:sandbox:sandbox-calc:confirm:${referenceId}`,
    cancelCallback: 'action:sandbox:sandbox-calc:cancel',
    confirmLabel: '✅ تأكيد',
    cancelLabel: '❌ إلغاء',
  });
  assertRichMessage(msg);
  return msg;
}
