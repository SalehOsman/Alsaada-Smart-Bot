import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { config } from '../config/env.js';

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
    `🤖 *محرك البوت المؤسسي الجديد (Al-Saada Enterprise Engine \`v${config.appVersion}\`)*\n\n` +
    `مرحباً بك يا *${name}* 👋\n\n` +
    `🔹 *المعرف الرقمي:* \`${ctx.from?.id}\`\n` +
    `🔹 *الصلاحية المعتمدة:* ${roleLabel}\n` +
    `🔹 *حالة الحساب:* ${user?.isActive ? '🟢 نشط ومعتمد' : '⏳ قيد المراجعة والتوثيق'}\n` +
    `🔹 *محرك البيانات:* PostgreSQL 16 (مشفر وموثق جنائياً)\n\n` +
    `⚙️ *حالة المنظومة الحالية:* جاهزة لبدء بناء وبرمجة التدفقات التشغيلية من الصفر وفق المعايير المعتمدة.\n` +
    `فحص كفاءة النظام: /ping`;

  await ctx.reply(welcomeText, {
    parse_mode: 'Markdown',
  });
}
