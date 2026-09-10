import type { UserRole } from '../../shared/module.types.js';

export function formatGhostModeMenu(): string {
  return (
    `🎭 *نظام محاكاة وتقمص الأدوار للمدير العام (Ghost Mode)*\n` +
    `────────────────────────────\n` +
    `يتيح لك هذا النظام التحول الفوري لتجربة واجهة وتدفقات أي دور تشغيلي داخل المنظومة وكأنك ذلك المستخدم، للتحقق من دقة الصلاحيات وسلامة الواجهات ميدانياً.\n\n` +
    `⚠️ *ضمانة الاستثناء السيادي:* مهما كان الدور المختار، يظل زر العودة كمدير عام متاحاً لك دائماً أسفل الواجهة، بالإضافة إلى الأمر المباشر \`/exit_ghost\`.\n\n` +
    `اختر الدور المراد تقمصه وتجربة واجهته:`
  );
}

export function formatImpersonateSuccess(role: UserRole): string {
  const roleTitles: Record<string, string> = {
    EXECUTIVE: 'الإدارة التنفيذية والمالية',
    FIELD_ADMIN: 'المشرف الميداني',
    WORKER: 'العامل الميداني',
    SUPPLIER: 'المورد ومقاول الباطن',
    GUEST: 'الزائر والمستخدم الجديد',
  };

  const title = roleTitles[role] || role;
  return `🎭 *تم تفعيل وضع المحاكاة بنجاح!*\nأنت الآن تتصفح المنظومة بصفتك: *${title}*`;
}

export function formatExitGhostSuccess(): string {
  return `👑 *تم إنهاء وضع المحاكاة بنجاح!*\nتم استعادة صلاحياتك الكاملة كمدير عام للمنظومة (SUPER_ADMIN).`;
}
