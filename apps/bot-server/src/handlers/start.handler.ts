import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';

export async function handleStart(ctx: MyContext): Promise<void> {
  const user = ctx.dbUser;
  const name = ctx.from?.first_name || 'أهلاً بك';
  const role = user?.role || 'GUEST';

  let roleLabel = 'زائر (بانتظار الاعتماد)';
  if (role === 'SUPER_ADMIN') roleLabel = '👑 مدير عام (سوبر أدمن)';
  else if (role === 'EXECUTIVE') roleLabel = '👔 إدارة تنفيذية';
  else if (role === 'FIELD_ADMIN') roleLabel = '🛡️ مشرف ميداني';
  else if (role === 'ACCOUNTANT') roleLabel = '💼 محاسب مالي';
  else if (role === 'WORKER') roleLabel = '👷 عامل مسجل';

  const welcomeText = 
    `🏢 *منظومة شركة السعادة للمقاولات العامة*\n` +
    `🤖 *محرك البوت المؤسسي الجديد (Al-Saada Enterprise Engine v2.0)*\n\n` +
    `مرحباً بك يا *${name}* 👋\n\n` +
    `🔹 *المعرف الرقمي:* \`${ctx.from?.id}\`\n` +
    `🔹 *الصلاحية المعتمدة:* ${roleLabel}\n` +
    `🔹 *حالة الحساب:* ${user?.isActive ? '🟢 نشط ومعتمد' : '⏳ قيد المراجعة والتوثيق'}\n` +
    `🔹 *محرك البيانات:* PostgreSQL 16 (مشفر وموثق جنائياً)\n\n` +
    (role === 'SUPER_ADMIN' 
      ? `✅ *حسابك مفعل بصلاحيات الإدارة العليا الكاملة.*\nيمكنك فحص حالة النظام عبر الأمر: /ping`
      : `⚠️ *حسابك مسجل حالياً برتبة زائر.*\nيرجى التواصل مع الإدارة لاعتماد صلاحيتك على المنظومة.`);

  const keyboard = new InlineKeyboard();
  if (role === 'SUPER_ADMIN') {
    keyboard
      .text('📊 لوحة القيادة', 'action:admin_dashboard')
      .text('⚡ فحص النظام', 'action:system_ping')
      .row()
      .text('👥 إدارة المستخدمين', 'action:manage_users')
      .text('👷 سجل العمالة 360', 'action:workers_hub');
  } else {
    keyboard.text('🔄 تحديث الحالة', 'action:refresh_status');
  }

  await ctx.reply(welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
