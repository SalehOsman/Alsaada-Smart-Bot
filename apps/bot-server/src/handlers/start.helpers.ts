import { MyContext } from '../types/context.js';
import { config } from '../config/env.js';

export function getRoleTitle(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '👑 مدير عام (سوبر أدمن)';
    case 'EXECUTIVE':
      return '👔 إدارة تنفيذية ومالية';
    case 'FIELD_ADMIN':
      return '🛡️ مشرف موقع وميداني';
    case 'ACCOUNTANT':
      return '💼 محاسب مالي';
    case 'WORKER':
      return '👷 عامل مسجل (بوابة الخدمة الذاتية)';
    case 'SUPPLIER':
      return '🚚 مورد / مقاول باطن';
    case 'GUEST':
    default:
      return '👤 زائر (بانتظار الربط والاعتماد)';
  }
}

export function buildWelcomeMessage(ctx: MyContext): string {
  const name = ctx.from?.first_name || 'أهلاً بك';
  const role = ctx.effectiveRole || 'GUEST';
  const roleTitle = getRoleTitle(role);

  let simulationBanner = '';
  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    simulationBanner =
      `🎭 *[ وضع المحاكاة النشط — GHOST MODE ]*\n` +
      `أنت تستعرض وتختبر النظام الآن بهوية: *${roleTitle}*\n` +
      `لإنهاء المحاكاة والعودة لصلاحيات المدير العام، اضغط زر الإنهاء بالأسفل.\n` +
      `────────────────────────\n\n`;
  }

  switch (role) {
    case 'SUPER_ADMIN':
      return (
        `${simulationBanner}` +
        `🏢 *منظومة شركة السعادة للمقاولات العامة*\n` +
        `🤖 *محرك البوت المؤسسي الجديد (Al-Saada Enterprise Engine \`v${config.appVersion}\`)*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `🔹 *المعرف الرقمي:* \`${ctx.from?.id}\`\n` +
        `🔹 *الصلاحية المعتمدة:* ${roleTitle}\n` +
        `🔹 *حالة الحساب:* 🟢 نشط ومعتمد\n` +
        `🔹 *محرك البيانات:* PostgreSQL 16 (مشفر وموثق جنائياً)\n\n` +
        `اختر القسم المطلوب من لوحة التحكم أدناه:`
      );

    case 'EXECUTIVE':
      return (
        `${simulationBanner}` +
        `👔 *بوابة الإدارة التنفيذية والمالية*\n` +
        `🏢 *شركة السعادة للمقاولات العامة*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `هنا يمكنك متابعة لوحات المؤشرات التشغيلية، السيولة النقدية، والموقف المالي للمشاريع.\n\n` +
        `اختر التقرير أو الإجراء المطلوب من القائمة أدناه:`
      );

    case 'FIELD_ADMIN':
      return (
        `${simulationBanner}` +
        `🛡️ *بوابة المشرف الميداني وإدارة المواقع*\n` +
        `🏢 *شركة السعادة للمقاولات العامة*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `🔹 *المعرف الرقمي:* \`${ctx.from?.id}\`\n` +
        `🔹 *الصلاحية المعتمدة:* ${roleTitle}\n` +
        `🔹 *حالة الحساب:* 🟢 نشط ومعتمد ميدانياً\n\n` +
        `اختر القسم التشغيلي المطلوب من لوحة التحكم أدناه:`
      );

    case 'WORKER':
      return (
        `${simulationBanner}` +
        `👷 *بوابة الخدمة الذاتية للعاملين*\n` +
        `🏢 *شركة السعادة للمقاولات العامة*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `هنا يمكنك الاستعلام عن كشف حسابك، مفردات قسيمة راتبك، وتقديم طلبات الإجازات والسلف.\n\n` +
        `اختر الخدمة المطلوبة من القائمة أدناه:`
      );

    case 'SUPPLIER':
      return (
        `${simulationBanner}` +
        `🚚 *بوابة الموردين ومقاولي الباطن*\n` +
        `🏢 *شركة السعادة للمقاولات العامة*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `هنا يمكنك استعراض الفواتير المعتمدة، دفعاتك المالية، وتصدير كشوف الحساب الرسمية.\n\n` +
        `اختر الإجراء المطلوب من القائمة أدناه:`
      );

    case 'GUEST':
    default:
      return (
        `${simulationBanner}` +
        `👤 *بوابة الزوار والمستخدمين الجدد*\n` +
        `🏢 *شركة السعادة للمقاولات العامة*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `حسابك غير مرتبط حالياً بأي سجل وظيفي أو مالي معتمد في المنظومة.\n` +
        `🔹 *معرفك الرقمي:* \`${ctx.from?.id}\`\n\n` +
        `يمكنك تزويد الإدارة بمعرفك لربط حسابك أو تقديم طلب تسجيل جديد من الخيارات أدناه:`
      );
  }
}
