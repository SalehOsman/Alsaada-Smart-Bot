import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';

/**
 * Clean placeholder handler for unbuilt sub-features and domain menus.
 * Guarantees zero dead ends and provides clean in-place navigation back to the main menu.
 */
export async function handleMenuPlaceholder(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  const callbackData = ctx.callbackQuery?.data || '';

  const keyboard = new InlineKeyboard()
    .text('🏠 العودة للقائمة الرئيسية', 'action:main_menu');

  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    keyboard
      .row()
      .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  const text =
    `🏗️ *هذا القسم قيد البناء البرمجي والربط الميداني*\n\n` +
    `🔹 *المعرف الإجرائي:* \`${callbackData}\`\n` +
    `🔹 *الحالة التشغيلية:* تم اعتماد هيكل الزر في القائمة الرئيسية، وجارٍ استكمال بناء معالج الإدخال والتحقق الميداني وفق وثيقة حوكمة الهجرة المؤسسية (SSOT).\n\n` +
    `اضغط أدناه للعودة:`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {
      // fallback
    }
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
