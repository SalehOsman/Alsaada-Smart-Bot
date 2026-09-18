import { formatBreadcrumbs, formatClickToCopy } from '@alsaada/core-components';
import type { AdminAssignmentDto } from './flow.types.js';

export function formatAdminAssignmentsHub(noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '👥 تعيين وتوزيع مشرفي المواقع']) +
    `${banner}` +
    `👥 *لوحة تعيين وتوزيع مدراء المواقع والفروع (Admin Site Scoping)*\n` +
    `────────────────────────────\n` +
    `🛡️ *محرك عزل الصلاحيات (RBAC Scoping):*\n` +
    `• تعيين المشرف على موقع محدد يحصر كافة صلاحياته وعمالته وعهدته ومصروفاته في حدود موقعه فقط.\n` +
    `• ترك المستخدم دون تعيين يمنحه صلاحية عامة وشاملة لكافة المواقع.\n\n` +
    `👇 *اختر المشرف المطلوب لتعديل نطاق إشرافه وموقعه:*`
  );
}

export function formatUserAssignmentCard(user: AdminAssignmentDto, noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  const currentScope = user.assignedSiteName ? `📍 موقع: *${user.assignedSiteName}*` : '🌐 *وصول عام وشامل (كافة المواقع)*';
  const statusBadge = user.isOnLeave ? '🌴 *في إجازة رسمية (موقوف ميدانياً)*' : '🟢 *نشط بالخدمة الميدانية*';
  const freezeBadge = user.freezeBotAccessOnLeave ? '🔒 مفعل (حجب البوت أثناء الإجازة)' : '🔓 معطل (دخول متاح دائماً)';
  const ejectBadge = user.ejectTelegramOnLeave ? '🚫 مفعل (طرد مؤقت أثناء الإجازة)' : '👥 معطل (بقاء بالمجموعة)';

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '👥 المشرفين', user.fullName]) +
    `${banner}` +
    `👤 *إدارة نطاق وسياسات المشرف: ${user.fullName}*\n` +
    `────────────────────────────\n` +
    `🔹 *المعرف الرقمي:* ${formatClickToCopy(user.telegramId)}\n` +
    `🔹 *الصفة الإدارية:* *${user.role}*\n` +
    `🔹 *الحالة التشغيلية:* ${statusBadge}\n` +
    `🔹 *النطاق الميداني الحالي:* ${currentScope}\n` +
    `────────────────────────────\n` +
    `⚙️ *سياسات الإجازة الميدانية (Leave Policies):*\n` +
    `• قفل دخول البوت: ${freezeBadge}\n` +
    `• حجب جروب التيليجرام: ${ejectBadge}\n` +
    `────────────────────────────\n` +
    `👇 *اختر الموقع الميداني، أو عدل سياسات وحالة إجازة المشرف:*`
  );
}
