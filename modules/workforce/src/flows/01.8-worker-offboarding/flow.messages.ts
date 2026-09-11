import type { TerminationReason } from './flow.types.js';
import { TERMINATION_REASON_LABELS } from './flow.types.js';

export function formatWorkerSelectHeader(): string {
  return (
    `📋 *إنهاء خدمة عامل وإخلاء طرف ومخالصة نهائية*\n` +
    `────────────────────────────\n` +
    `اختر العامل المراد إجراء إنهاء الخدمة والمخالصة له من القائمة الميدانية:`
  );
}

export function formatReasonSelectHeader(workerName: string, workerCode: string): string {
  return (
    `⚠️ *تحديد سبب إنهاء الخدمة للعامل*\n` +
    `────────────────────────────\n` +
    `العامل: *${workerName}* (كود: \`#${workerCode}\`)\n\n` +
    `👇 *اختر السبب المعتمد لإنهاء الخدمة:*`
  );
}

export function formatConfirmationCard(
  workerName: string,
  workerCode: string,
  reason: TerminationReason,
  hasLinkedTelegram: boolean,
  notes?: string
): string {
  const reasonText = TERMINATION_REASON_LABELS[reason] || reason;
  const telegramDemoteWarning = hasLinkedTelegram
    ? `\n🔒 *إسقاط الصلاحيات اللحظي:* حساب التليجرام المرتبط سيتم هبوطه فوراً لصفة **زائر (GUEST)**، وتصفير الصلاحيات والأوامر الجانبية لمنع أي تسريب بيانات.`
    : `\nℹ️ العامل ليس لديه حساب تليجرام مفعل حالياً.`;

  return (
    `🚨 *تأكيد نهائي: اعتماد سند إنهاء الخدمة وإخلاء الطرف*\n` +
    `────────────────────────────\n` +
    `🔹 *العامل:* *${workerName}* (\`#${workerCode}\`)\n` +
    `🔹 *السبب المعتمد:* ${reasonText}\n` +
    (notes ? `🔹 *الملاحظات:* ${notes}\n` : '') +
    telegramDemoteWarning +
    `\n\nهل ترغب في اعتماد المخالصة وإغلاق السجل الوظيفي نهائياً؟`
  );
}

export function formatSuccessCard(
  workerName: string,
  workerCode: string,
  refId: string,
  demoted: boolean
): string {
  const demotedText = demoted
    ? `\n✅ *تم هبوط حساب التليجرام لدور زائر (GUEST) وتصفير أوامره فورياً.*`
    : '';

  return (
    `🎉 *تم اعتماد إنهاء الخدمة والمخالصة بنجاح*\n` +
    `────────────────────────────\n` +
    `🔹 *العامل:* *${workerName}* (\`#${workerCode}\`)\n` +
    `🔹 *رقم سند المخالصة:* \`${refId}\`\n` +
    `🔹 *حالة السجل:* 🔴 منهي الخدمة ومؤرشف جنائياً\n` +
    demotedText +
    `\n\nتم قيد العملية في السجل الجنائي وترحيلها لطابور المزامنة الخلفية.`
  );
}

export function formatOffboardingNotification(
  workerName: string,
  workerCode: string,
  reason: TerminationReason,
  refId: string,
  siteName?: string
): string {
  const reasonText = TERMINATION_REASON_LABELS[reason] || reason;
  return (
    `🚨 *إشعار إنهاء خدمة وإخلاء طرف عامل*\n` +
    `────────────────────────────\n` +
    `• *العامل:* ${workerName} (\`#${workerCode}\`)\n` +
    `• *السبب المعتمد:* ${reasonText}\n` +
    `• *الموقع:* ${siteName || 'الموقع العام'}\n` +
    `• *رقم سند المخالصة:* \`${refId}\``
  );
}
