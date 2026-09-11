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

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '👥 المشرفين', user.fullName]) +
    `${banner}` +
    `👤 *تعديل نطاق صلاحيات المشرف: ${user.fullName}*\n` +
    `────────────────────────────\n` +
    `🔹 *المعرف الرقمي:* ${formatClickToCopy(user.telegramId)}\n` +
    `🔹 *الصفة الإدارية:* *${user.role}*\n` +
    `🔹 *النطاق الميداني الحالي:* ${currentScope}\n` +
    `────────────────────────────\n` +
    `👇 *اختر الموقع الميداني المراد تعيينه عليه، أو اختر صلاحية عامة:*`
  );
}
