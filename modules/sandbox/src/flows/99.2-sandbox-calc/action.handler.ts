/**
 * Callback Query and Event Actions for Flow 99.2 (sandbox-calc)
 */

import {
  buildRichPage,
  assertRichMessage,
  richParagraph,
} from '@alsaada/core-components';
import { SandboxCalcService } from './service.js';
import {
  buildSandboxCalcConfirmMessage,
  buildSandboxCalcConfirmKeyboard,
  buildSandboxCalcResultTable,
} from './menu.builder.js';

export interface FlowContextLike {
  reply: (content: unknown, extra?: Record<string, unknown>) => Promise<unknown>;
  callbackQuery?: { data?: string };
  answerCallbackQuery?: (opts?: unknown) => Promise<unknown>;
  editMessageText?: (content: unknown, extra?: Record<string, unknown>) => Promise<unknown>;
}

export async function handleSandboxCalcAction(ctx: FlowContextLike, service: SandboxCalcService) {
  const data = ctx.callbackQuery?.data ?? '';

  if (typeof ctx.answerCallbackQuery === 'function') {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  if (data.endsWith(':start') || data.endsWith(':net')) {
    const confirmMsg = buildSandboxCalcConfirmMessage('calc-1');
    assertRichMessage(confirmMsg);
    const text = '⚠️ *تأكيد العملية*\n\nهل تريد تأكيد تنفيذ عملية الحساب والقناع المالي (calc-1)؟';
    const content = Object.assign(new String(text), confirmMsg);
    await ctx.reply(content, {
      parse_mode: 'Markdown',
      reply_markup: buildSandboxCalcConfirmKeyboard('calc-1'),
    });
    return true;
  }

  if (data.endsWith(':mask')) {
    const sampleRecord = { basicSalary: 7500, allowances: 1000, deductions: 250 };
    const masked = service.maskFinancialRecord(sampleRecord, 'FIELD_ADMIN');
    const tableMsg = buildSandboxCalcResultTable(masked);
    assertRichMessage(tableMsg);
    const text = `📊 *كشف المستحقات المالية*\n\n▫️ *الراتب الأساسي:* ${masked.basicSalary}\n▫️ *البدلات:* ${masked.allowances}\n▫️ *الاستقطاعات:* ${masked.deductions}\n▫️ *صافي المستحق:* ${masked.netPay}`;
    const content = Object.assign(new String(text), tableMsg);
    await ctx.reply(content, { parse_mode: 'Markdown' });
    return true;
  }

  if (data.includes(':confirm')) {
    const refMatch = data.match(/:confirm:?([^:]*)$/);
    const refId = refMatch?.[1] || 'calc-1';
    const net = service.calculateNetPay({
      basicSalary: 7500,
      allowances: 1000,
      deductions: 250,
    });
    const msg = buildRichPage({
      title: '✅ تأكيد العملية الحسابية',
      blocks: [
        richParagraph(
          `تم تأكيد واحتساب الراتب للعملية (${refId}) بنجاح: صافي المستحق ${net.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م`
        ),
      ],
    });
    assertRichMessage(msg);
    const text = `✅ *تأكيد العملية الحسابية*\n\nتم تأكيد واحتساب الراتب للعملية (${refId}) بنجاح:\n*صافي المستحق:* ${net.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م`;
    const content = Object.assign(new String(text), msg);
    await ctx.reply(content, { parse_mode: 'Markdown' });
    return true;
  }

  if (data.endsWith(':cancel')) {
    const msg = buildRichPage({
      title: '❌ تم إلغاء العملية',
      blocks: [richParagraph('تم إلغاء عملية احتساب الراتب والقناع المالي.')],
    });
    assertRichMessage(msg);
    const text = '❌ *تم إلغاء العملية*\n\nتم إلغاء عملية احتساب الراتب والقناع المالي.';
    const content = Object.assign(new String(text), msg);
    await ctx.reply(content, { parse_mode: 'Markdown' });
    return true;
  }

  return false;
}
