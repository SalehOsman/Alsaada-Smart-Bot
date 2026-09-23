/**
 * Telegram Keyboard & Message Builders for Flow 99.1
 * Enforces Telegram Ergonomics Budget (36/16/7/3) and Sovereign Rich Message Standard
 */

import {
  buildRichPage,
  buildRichConfirmation,
  assertRichMessage,
  richParagraph,
} from '@alsaada/core-components';

export type InputRichMessage = ReturnType<typeof buildRichPage>;

export function buildSandboxPingMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '▶️ بدء الإجراء', callback_data: 'action:sandbox:sandbox-ping:start' },
        { text: '🔙 رجوع للمختبر', callback_data: 'action:sandbox:main' },
      ],
    ],
  };
}

export function buildSandboxPingConfirmKeyboard(referenceId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ تأكيد', callback_data: 'action:sandbox:sandbox-ping:confirm:' + referenceId },
        { text: '❌ إلغاء', callback_data: 'action:sandbox:sandbox-ping:cancel' },
      ],
    ],
  };
}

export function formatSandboxPingPrompt(titleArabic: string): string {
  return `📌 *${titleArabic}*\n\nيرجى مراجعة التفاصيل وتأكيد العملية:`;
}

export function buildSandboxPingPromptMessage(titleArabic: string): InputRichMessage {
  const msg = buildRichPage({
    title: `🧪 ${titleArabic}`,
    blocks: [
      richParagraph('يرجى مراجعة التفاصيل وتأكيد العملية:'),
    ],
  });
  assertRichMessage(msg);
  return msg;
}

export function buildSandboxPingConfirmMessage(referenceId: string): InputRichMessage {
  const msg = buildRichConfirmation({
    question: `تأكيد فحص النبض والاستجابة (${referenceId})؟`,
    confirmCallback: `action:sandbox:sandbox-ping:confirm:${referenceId}`,
    cancelCallback: 'action:sandbox:sandbox-ping:cancel',
    confirmLabel: '✅ تأكيد',
    cancelLabel: '❌ إلغاء',
  });
  assertRichMessage(msg);
  return msg;
}
