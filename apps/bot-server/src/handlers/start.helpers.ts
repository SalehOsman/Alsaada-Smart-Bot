import { MyContext } from '../types/context.js';
import { config } from '../config/env.js';

export function getRoleTitle(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '👑 مدير عام المنظومة (سوبر أدمن)';
    case 'GENERAL_ADMIN':
      return '👑 المدير العام التشغيلي (جينرال أدمن)';
    case 'FIELD_ADMIN':
      return '🛡️ مشرف موقع ميداني';
    case 'WORKER_SUPERVISOR':
      return '👷 العامل المشرف المفوض';
    case 'WORKER':
      return '👷 عامل مسجل (بوابة الخدمة الذاتية)';
    case 'SUPPLIER':
      return '🚚 مورد / مقاول باطن';
    case 'GUEST':
    default:
      return '👤 زائر (بانتظار الربط والاعتماد)';
  }
}

export function buildWelcomeMessage(ctx: MyContext, companyName?: string): string {
  const isSimulatedEntity = Boolean(ctx.isImpersonating && ctx.impersonatedEntity?.name);
  const name = isSimulatedEntity
    ? (ctx.impersonatedEntity!.code
        ? `${ctx.impersonatedEntity!.name} (${ctx.impersonatedEntity!.code})`
        : ctx.impersonatedEntity!.name)
    : (ctx.from?.first_name || 'أهلاً بك');
  const role = ctx.effectiveRole || 'GUEST';
  const roleTitle = getRoleTitle(role);
  const company = companyName || 'المنظومة المؤسسية';

  let simulationBanner = '';
  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    const identitySubtitle = ctx.impersonatedEntity?.name
      ? `\n🔹 *المستخدم المحاكى:* ${ctx.impersonatedEntity.name}${ctx.impersonatedEntity.code ? ` (\`${ctx.impersonatedEntity.code}\`)` : ''}`
      : '';
    simulationBanner =
      `🎭 *[ وضع المحاكاة النشط — GHOST MODE ]*\n` +
      `أنت تستعرض وتختبر النظام الآن بهوية: *${roleTitle}*${identitySubtitle}\n` +
      `لإنهاء المحاكاة والعودة لصلاحيات المدير العام، اضغط زر الإنهاء بالأسفل.\n` +
      `────────────────────────\n\n`;
  }

  switch (role) {
    case 'SUPER_ADMIN':
      return (
        `${simulationBanner}` +
        `🏢 *منظومة ${company}*\n` +
        `🤖 *محرك البوت المؤسسي الجديد (Al-Saada Enterprise Engine \`v${config.appVersion}\`)*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `🔹 *المعرف الرقمي:* \`${ctx.from?.id}\`\n` +
        `🔹 *الصلاحية المعتمدة:* ${roleTitle}\n` +
        `🔹 *حالة الحساب:* 🟢 نشط ومعتمد\n` +
        `🔹 *محرك البيانات:* PostgreSQL 16 (مشفر وموثق جنائياً)\n\n` +
        `اختر القسم المطلوب من لوحة التحكم أدناه:`
      );

    case 'GENERAL_ADMIN':
      return (
        `${simulationBanner}` +
        `🏢 *بوابة الإدارة العامة والتشغيل*\n` +
        `🏢 *${company}*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `هنا يمكنك متابعة لوحات المؤشرات التشغيلية، السيولة النقدية، والموقف المالي لكافة المشاريع.\n\n` +
        `اختر التقرير أو الإجراء المطلوب من القائمة أدناه:`
      );

    case 'FIELD_ADMIN':
      return (
        `${simulationBanner}` +
        `🛡️ *بوابة المشرف الميداني وإدارة المواقع*\n` +
        `🏢 *${company}*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `🔹 *المعرف الرقمي:* \`${ctx.from?.id}\`\n` +
        `🔹 *الصلاحية المعتمدة:* ${roleTitle}\n` +
        `🔹 *حالة الحساب:* 🟢 نشط ومعتمد ميدانياً\n\n` +
        `اختر القسم التشغيلي المطلوب من لوحة التحكم أدناه:`
      );

    case 'WORKER_SUPERVISOR':
      return (
        `${simulationBanner}` +
        `👷 *بوابة العامل المشرف المفوض*\n` +
        `🏢 *${company}*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `لديك صلاحيات تشغيلية مفوضة داخل موقعك لتسجيل العمليات اليومية المعتمدة.\n\n` +
        `اختر العملية المطلوبة من القائمة أدناه:`
      );

    case 'WORKER':
      return (
        `${simulationBanner}` +
        `👷 *بوابة الخدمة الذاتية للعاملين*\n` +
        `🏢 *${company}*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `هنا يمكنك الاستعلام عن كشف حسابك، مفردات قسيمة راتبك، وتقديم طلبات الإجازات والسلف.\n\n` +
        `اختر الخدمة المطلوبة من القائمة أدناه:`
      );

    case 'SUPPLIER':
      return (
        `${simulationBanner}` +
        `🚚 *بوابة الموردين ومقاولي الباطن*\n` +
        `🏢 *${company}*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `هنا يمكنك استعراض الفواتير المعتمدة، دفعاتك المالية، وتصدير كشوف الحساب الرسمية.\n\n` +
        `اختر الإجراء المطلوب من القائمة أدناه:`
      );

    case 'GUEST':
    default:
      return (
        `${simulationBanner}` +
        `👤 *بوابة الزوار والمستخدمين الجدد*\n` +
        `🏢 *${company}*\n\n` +
        `مرحباً بك يا *${name}* 👋\n\n` +
        `حسابك غير مرتبط حالياً بأي سجل وظيفي أو مالي معتمد في المنظومة.\n` +
        `🔹 *معرفك الرقمي:* \`${ctx.from?.id}\`\n\n` +
        `يمكنك تزويد الإدارة بمعرفك لربط حسابك أو تقديم طلب تسجيل جديد من الخيارات أدناه:`
      );
  }
}
