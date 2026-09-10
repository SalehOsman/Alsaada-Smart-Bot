import { InlineKeyboard } from 'grammy';
import type { WorkforceModuleContext } from '../shared/module.types.js';

export async function handleSwitchToWorker(
  ctx: WorkforceModuleContext,
  renderHome?: (ctx: WorkforceModuleContext, inPlace?: boolean) => Promise<void>
): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;

  if (ctx.effectiveRole !== 'FIELD_ADMIN' && ctx.effectiveRole !== 'WORKER') {
    await ctx.reply('⚠️ تبديل الهوية متاح حصراً للمشرفين الميدانيين الذين يمتلكون سجلاً وظيفياً كعمال.', { parse_mode: 'Markdown' });
    return;
  }

  if (ctx.session) {
    ctx.session.userMode = 'WORKER';
  }

  const text =
    '👷 *تم التحويل إلى وضع العامل بنجاح*\n' +
    '━━━━━━━━━━━━━━━━━━━━━\n' +
    'أنت تتصفح البوت الآن بصفتك عاملاً ميدانياً. تقتصر خياراتك على:\n' +
    '• 📋 استعراض بطاقة المعرف والبيانات الشخصية\n' +
    '• 🏖️ رصيد الإجازات وتفاصيل الدوام\n' +
    '• 💵 السلف والمسحوبات الشخصية\n\n' +
    '💡 للعودة إلى وضع المشرف، استخدم الزر أسفل الشاشة أو القائمة الجانبية.';

  const kb = new InlineKeyboard()
    .text('🔙 العودة لوضع المشرف الميداني', 'action:switch_identity:field_admin')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb }).catch(() => {});
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }
}

export async function handleSwitchToFieldAdmin(
  ctx: WorkforceModuleContext,
  renderHome?: (ctx: WorkforceModuleContext, inPlace?: boolean) => Promise<void>
): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;

  if (ctx.session) {
    ctx.session.userMode = 'FIELD_ADMIN';
  }

  const text =
    '🦺 *تمت العودة إلى وضع المشرف الميداني بنجاح*\n' +
    '━━━━━━━━━━━━━━━━━━━━━\n' +
    'تمت استعادة كافة صلاحيات الإشراف الميداني، إدارة العمال، تسجيل الحركات، والعهد بالموقع.';

  const kb = new InlineKeyboard()
    .text('👷 التبديل لوضع العامل', 'action:switch_identity:worker')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb }).catch(() => {});
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }
}

export async function handleSwitchRoleCommand(ctx: WorkforceModuleContext): Promise<void> {
  const currentMode = ctx.session?.userMode || (ctx.effectiveRole === 'WORKER' ? 'WORKER' : 'FIELD_ADMIN');
  if (currentMode === 'WORKER') {
    await handleSwitchToFieldAdmin(ctx);
  } else {
    await handleSwitchToWorker(ctx);
  }
}
