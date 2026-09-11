import { formatBreadcrumbs, formatClickToCopy } from '@alsaada/core-components';
import type { AdminProfileDto, AdminFieldKey } from './flow.types.js';

export function formatAdminProfileCard(profile: AdminProfileDto, noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '👤 الحساب والأمان والمحاكاة', '👑 حساب المدير العام']) +
    `${banner}` +
    `👑 *الملف الشخصي للمدير العام (Super Admin)*\n` +
    `────────────────────────────\n` +
    `بيانات حسابك السيادي كمسؤول رئيسي للمنظومة:\n\n` +
    `👤 *الاسم الرسمي:* \`${profile.fullName || 'غير مسجل'}\`\n` +
    `📱 *رقم الهاتف المعتمد:* \`${profile.phone || 'غير مسجل'}\`\n` +
    `🆔 *معرف التليجرام:* ${formatClickToCopy(profile.telegramId)}\n` +
    `🛡️ *الصفة الإدارية:* *مدير عام المنظومة (SUPER_ADMIN)*\n` +
    `🔐 *مستوى التشفير:* *AES-256 مشفر ومحمي*\n` +
    `────────────────────────────\n` +
    `👇 *اختر الإجراء المطلوب للتعديل:*`
  );
}

export function formatEditAdminFieldPrompt(fieldKey: AdminFieldKey, currentVal: string): string {
  const label = fieldKey === 'fullName' ? 'الاسم الرسمي' : 'رقم الهاتف المعتمد';
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '👤 الحساب والأمان والمحاكاة', '✏️ تعديل الحساب']) +
    `✏️ *تعديل: ${label}*\n` +
    `────────────────────────────\n` +
    `🔹 *القيمة الحالية:*\n\`${currentVal}\`\n\n` +
    `💬 *أرسل القيمة الجديدة الآن في رسالة نصية:*`
  );
}

export function formatFieldAdminProfileCard(profile: AdminProfileDto, noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '👤 الحساب والأمان', '🛡️ حساب المشرف الميداني']) +
    `${banner}` +
    `🛡️ *الملف الشخصي وإعدادات المشرف الميداني*\n` +
    `────────────────────────────\n` +
    `👤 *الاسم المسجل:*\n\`${profile.fullName || 'غير مسجل'}\`\n\n` +
    `📱 *رقم الهاتف:*\n\`${profile.phone || 'غير مسجل'}\`\n\n` +
    `📍 *الموقع المسؤول:* ${profile.assignedSiteName || '🌐 وصول عام / غير مقيد بموقع محدد'}\n` +
    `🆔 *المعرف الرقمي:* ${formatClickToCopy(profile.telegramId)}\n` +
    `🛡️ *حالة الحساب:* 🟢 نشط ومعتمد ميدانياً\n` +
    `────────────────────────────\n` +
    `💡 *التبديل لحساب العامل:* يتيح لك الاطلاع على كشف حسابك ومسحوباتك وتقديم طلباتك الشخصية دون تداخل مع صلاحياتك الإشرافية.\n\n` +
    `👇 *اختر الإجراء المطلوب:*`
  );
}

