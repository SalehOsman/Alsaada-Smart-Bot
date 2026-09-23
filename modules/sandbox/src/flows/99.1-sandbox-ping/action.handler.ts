/**
 * Callback Query and Event Actions for Flow 99.1
 */

import {
  buildRichPage,
  assertRichMessage,
  richParagraph,
} from '@alsaada/core-components';
import { SandboxPingService } from './service.js';
import {
  buildSandboxPingConfirmMessage,
  buildSandboxPingConfirmKeyboard,
} from './menu.builder.js';

export interface FlowContextLike {
  reply: (content: unknown, extra?: Record<string, unknown>) => Promise<unknown>;
  callbackQuery?: { data?: string };
  answerCallbackQuery?: (opts?: unknown) => Promise<unknown>;
  editMessageText?: (content: unknown, extra?: Record<string, unknown>) => Promise<unknown>;
}

export async function handleSandboxPingAction(ctx: FlowContextLike, service: SandboxPingService) {
  const data = ctx.callbackQuery?.data ?? '';

  if (typeof ctx.answerCallbackQuery === 'function') {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  if (data.endsWith(':start')) {
    const confirmMsg = buildSandboxPingConfirmMessage('ref-1');
    assertRichMessage(confirmMsg);
    const text = '⚠️ *تأكيد العملية*\n\nيرجى تأكيد تنفيذ فحص النبض والاستجابة (ref-1):';
    const content = Object.assign(new String(text), confirmMsg);
    await ctx.reply(content, {
      parse_mode: 'Markdown',
      reply_markup: buildSandboxPingConfirmKeyboard('ref-1'),
    });
    return true;
  }

  if (data.includes(':confirm')) {
    const refMatch = data.match(/:confirm:?([^:]*)$/);
    const refId = refMatch?.[1] || 'ref-1';
    const result = await service.executeOperation({
      idempotencyKey: `PING-${refId}-confirmed`,
      actorTelegramId: 'user',
      notes: `Confirmed reference ${refId}`,
    });
    const msg = buildRichPage({
      title: '✅ اكتمال فحص النبض والاستجابة',
      blocks: [richParagraph(result.messageArabic)],
    });
    assertRichMessage(msg);
    const text = `✅ *اكتمال فحص النبض والاستجابة*\n\n${result.messageArabic}`;
    const content = Object.assign(new String(text), msg);
    await ctx.reply(content, { parse_mode: 'Markdown' });
    return true;
  }

  if (data.endsWith(':cancel')) {
    const msg = buildRichPage({
      title: '❌ تم إلغاء العملية',
      blocks: [richParagraph('تم إلغاء فحص النبض والاستجابة بناءً على طلبك.')],
    });
    assertRichMessage(msg);
    const text = '❌ *تم إلغاء العملية*\n\nتم إلغاء فحص النبض والاستجابة بناءً على طلبك.';
    const content = Object.assign(new String(text), msg);
    await ctx.reply(content, { parse_mode: 'Markdown' });
    return true;
  }

  return false;
}
