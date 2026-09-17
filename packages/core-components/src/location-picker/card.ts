import { formatBreadcrumbs } from '../formatting/telegram-formatters.js';
import type { LocationPromptCardOptions } from './types.js';

/**
 * Formats a prompt card instructing the user on how to share their GPS location via Telegram.
 */
export function formatLocationPromptCard(options: LocationPromptCardOptions = {}): string {
  const crumbs = options.breadcrumbs ?? ['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '🏗️ إضافة موقع', 'الموقع الجغرافي'];
  const title = options.title ?? '📍 *تحديد الموقع الجغرافي (GPS) — الخطوة 4 من 5*';
  const siteLine = options.siteName ? `موقع: *${options.siteName}*\n\n` : '';
  const instructions =
    options.instructions ??
    `💬 *أرسل الموقع الجغرافي للموقع عبر التيليجرام:*\n` +
    `1️⃣ اضغط على أيقونة المشبك 📎 أسفل شاشة المحادثة.\n` +
    `2️⃣ اختر *الموقع (Location)* 📍 من القائمة.\n` +
    `3️⃣ اضغط *إرسال موقعي الحالي* أو حدد النقطة الميدانية على الخريطة.`;

  const note =
    options.note ??
    `\n\n💡 *ملاحظة:* يمكنك الضغط على زر التخطي أدناه لإتمام تسجيل الموقع دون إحداثيات الآن وتحديثها لاحقاً.`;

  return (
    formatBreadcrumbs(crumbs) +
    `${title}\n` +
    `────────────────────────────\n` +
    siteLine +
    instructions +
    note
  );
}
