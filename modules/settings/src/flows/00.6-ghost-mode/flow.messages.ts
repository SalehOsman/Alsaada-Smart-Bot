import type { UserRole } from '../../shared/module.types.js';

export function formatGhostModeMenu(): string {
  return (
    `🎭 *نظام محاكاة وتقمص الأدوار للمدير العام (Ghost Mode)*\n` +
    `────────────────────────────\n` +
    `يتيح لك هذا النظام التحول الفوري لتجربة واجهة وتدفقات أي دور تشغيلي داخل المنظومة وكأنك ذلك المستخدم، للتحقق من دقة الصلاحيات وسلامة الواجهات ميدانياً.\n\n` +
    `⚠️ *ضمانة الاستثناء السيادي:* مهما كان الدور المختار، يظل زر العودة كمدير عام متاحاً لك دائماً أسفل الواجهة، بالإضافة إلى الأمر المباشر \`/exit_ghost\`.\n\n` +
    `اختر الدور أو الكيان المراد تقمصه وتجربة واجهته:`
  );
}

export function formatWorkerPickerHeader(): string {
  return (
    `👷 *اختيار العامل المراد تقمص دوره (محاكاة العامل)*\n` +
    `────────────────────────────\n` +
    `اختر عاملاً مسجلاً بالمنظومة لتقمص حسابه بالكامل واستعراض كشف حسابه وقسيمة راتبه ومسحوباته الفعلية:`
  );
}

export function formatSupplierPickerHeader(): string {
  return (
    `🚚 *اختيار المورد المراد تقمص دوره (محاكاة المورد)*\n` +
    `────────────────────────────\n` +
    `اختر مورداً أو مقاول باطن مسجلاً بالمنظومة لتقمص حسابه واستعراض فواتيره ومستحقاته المالية:`
  );
}

export function formatImpersonateSuccess(role: UserRole, entityName?: string): string {
  const roleTitles: Record<string, string> = {
    GENERAL_ADMIN: 'الإدارة العامة (جينرال أدمن)',
    FIELD_ADMIN: 'المشرف الميداني (أدمن موقع)',
    WORKER: entityName ? `العامل: ${entityName}` : 'العامل الميداني',
    SUPPLIER: entityName ? `المورد: ${entityName}` : 'المورد ومقاول الباطن',
    GUEST: 'الزائر والمستخدم الجديد',
  };

  const title = roleTitles[role] || role;
  return (
    `🎭 *تم تفعيل وضع المحاكاة بنجاح!*\n` +
    `────────────────────────────\n` +
    `أنت الآن تتصفح المنظومة وتختبر شاشاتها بصفتك: *${title}*\n\n` +
    `📌 _تم تثبيت زر إنهاء المحاكاة في الكيبورد السفلي للعودة في أي لحظة._`
  );
}

export function formatExitGhostSuccess(): string {
  return `👑 *تم إنهاء وضع المحاكاة بنجاح!*\nتم استعادة صلاحياتك الكاملة كمدير عام للمنظومة (\`SUPER_ADMIN\`).`;
}

