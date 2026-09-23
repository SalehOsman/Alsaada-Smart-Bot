/**
 * Centralized Error Boundary for Flow 99.2
 */

import {
  buildRichPage,
  assertRichMessage,
  richParagraph,
} from '@alsaada/core-components';

interface ContextWithReply {
  reply?: (message: unknown) => Promise<unknown>;
}

export function handleSandboxCalcError(error: unknown, ctx?: unknown): { handled: boolean; userMessageArabic: string } {
  const message = error instanceof Error ? error.message : String(error);
  const userMessageArabic = '⚠️ حدث خطأ أثناء تنفيذ العملية. يرجى المحاولة لاحقاً.';

  const targetCtx = ctx as ContextWithReply | undefined;
  if (targetCtx && typeof targetCtx.reply === 'function') {
    try {
      const msg = buildRichPage({
        title: '⚠️ خطأ في العملية',
        blocks: [richParagraph(userMessageArabic)],
      });
      assertRichMessage(msg);
      const text = `⚠️ *خطأ في العملية*\n\n${userMessageArabic}`;
      const content = Object.assign(new String(text), msg);
      void targetCtx.reply(content).catch(() => {});
    } catch {
      // safe fallback
    }
  }

  return {
    handled: true,
    userMessageArabic,
  };
}
