import { formatBreadcrumbs } from '@alsaada/core-components';
import type { SiteDto } from './flow.types.js';

export function formatSitesListCard(sites: SiteDto[], noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان المؤسسي والمشاريع', '🏗️ مصفوفة المواقع']) +
    `${banner}` +
    `🏗️ *مصفوفة المشاريع والفروع والمواقع الميدانية*\n` +
    `────────────────────────────\n` +
    `دليل المواقع التشغيلية ومراكز التكلفة والمناجم التابعة للشركة.\n` +
    `📊 *إجمالي المواقع المسجلة:* ${sites.length} موقع\n\n` +
    `👇 *اختر الموقع المطلوب أدناه للاطلاع على بطاقته أو تعديل بياناته:*`
  );
}

export function formatSiteDetailCard(site: SiteDto, noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  const statusText = site.status === 'ACTIVE' ? '🟢 نشط ويعمل ميدانياً' : '🔴 متوقف / مجمد مؤقتاً';
  const locationText =
    site.latitude && site.longitude
      ? `\`${site.latitude}, ${site.longitude}\`\n[🗺️ فتح الموقع على Google Maps](https://maps.google.com/?q=${site.latitude},${site.longitude})`
      : 'غير محدد';

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '🏗️ المواقع', site.name]) +
    `${banner}` +
    `🏗️ *بطاقة الموقع الميداني: ${site.name}*\n` +
    `────────────────────────────\n` +
    `🔹 *كود الموقع المعياري:* \`${site.code}\`\n` +
    `🔹 *الحالة التشغيلية:* ${statusText}\n` +
    `🔹 *المحافظة / الإقليم:* \`${site.governorate || 'غير محدد'}\`\n` +
    `🔹 *المشروع التابع له:* \`${site.projectName || 'غير مخصص'}\`\n` +
    `🔹 *نطاق السياج الجغرافي:* \`${site.geofenceRadiusMeters} متر\`\n` +
    `🔹 *عدد العمالة النشطة به:* \`${site.workerCount} عامل\`\n` +
    `🔹 *إحداثيات الـ GPS:*\n${locationText}\n` +
    `────────────────────────────\n` +
    `👇 *الخيارات المتاحة:*`
  );
}

export function formatAddSiteNamePrompt(): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '🏗️ إضافة موقع']) +
    `➕ *إضافة موقع ميداني جديد — الخطوة 1 من 4*\n` +
    `────────────────────────────\n` +
    `💬 *أرسل اسم الموقع أو الفرع الجديد الآن في رسالة نصية:*\n` +
    `(مثال: موقع العاصمة الإدارية R3 أو محجر السويس)`
  );
}

export function formatConfirmCodePrompt(name: string, suggestedCode: string): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '🏗️ إضافة موقع', 'كود الموقع']) +
    `➕ *تأكيد كود الموقع — الخطوة 2 من 4*\n` +
    `────────────────────────────\n` +
    `اسم الموقع: *${name}*\n` +
    `الكود التلقائي المقترح: \`${suggestedCode}\`\n\n` +
    `اضغط على الزر أدناه لتأكيد هذا الكود أو أرسل كوداً مخصصاً في رسالة.`
  );
}

export function formatSelectGovPrompt(name: string): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '🏗️ إضافة موقع', 'المحافظة']) +
    `➕ *تحديد المحافظة — الخطوة 3 من 4*\n` +
    `────────────────────────────\n` +
    `موقع: *${name}*\n\n` +
    `اختر المحافظة أو الإقليم التابع له الموقع من الأزرار أدناه:`
  );
}

export function formatSelectGeofencePrompt(name: string): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '🏗️ إضافة موقع', 'السياج الجغرافي']) +
    `➕ *تحديد السياج الجغرافي (Geofence) — الخطوة 4 من 4*\n` +
    `────────────────────────────\n` +
    `موقع: *${name}*\n\n` +
    `حدد نصف قطر السياج الجغرافي المسموح بتسجيل الحضور وتحديد النطاق بداخله:`
  );
}
