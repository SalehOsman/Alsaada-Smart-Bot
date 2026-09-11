import { formatBreadcrumbs, formatClickToCopy } from '@alsaada/core-components';
import type { UserJourneyStep, UnresolvedErrorDto, PurgeResultDto } from './flow.types.js';

export function formatAuditVaultHub(noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '⚡ أداء وتشغيل المنظومة والرقابة', '🛡️ التحقيق الجنائي وسجل الأعطال']) +
    `${banner}` +
    `🛡️ *وحدة التحقيق الجنائي وسجل الحركات الميدانية*\n` +
    `────────────────────────────\n` +
    `نظام الصندوق الأسود لتتبع سلوك العمليات والتحقيق في الأعطال وحفظ سلامة البيانات:\n\n` +
    `🔍 *تتبع مسار مستخدم محدد:* فحص آخر 10 حركات تفاعلية لمعرفة تسلسل الخطوات التي سبقت الخطأ.\n` +
    `🚨 *كونسول الأعطال النشطة:* حصر ومعالجة الاستثناءات البرمجية المفتوحة واعتماد إغلاقها.\n` +
    `🧹 *تطهير وأرشفة السجلات:* تخفيف الحمل وحذف السجلات القديمة (> 30 يوماً).\n` +
    `────────────────────────────\n` +
    `👇 *اختر الإجراء المطلوب:*`
  );
}

export function formatUserJourneyTimeline(target: string, steps: UserJourneyStep[]): string {
  if (steps.length === 0) {
    return (
      formatBreadcrumbs(['⚙️ الإعدادات', '⚡ الرقابة والأداء', '🛡️ التحقيق الجنائي', '🔍 تتبع مسار']) +
      `🔍 *شريط مسار المستخدم (User Audit Journey)*\n` +
      `────────────────────────────\n` +
      `المستخدم: ${formatClickToCopy(target)}\n\n` +
      `⚠️ لم يتم العثور على أي حركات مسجلة لهذا المستخدم في الـ 24 ساعة الأخيرة.`
    );
  }

  let text =
    formatBreadcrumbs(['⚙️ الإعدادات', '⚡ الرقابة والأداء', '🛡️ التحقيق الجنائي', '🔍 تتبع مسار']) +
    `🔍 *شريط مسار المستخدم (User Audit Journey)*\n` +
    `────────────────────────────\n` +
    `المستخدم المستهدف: ${formatClickToCopy(target)}\n` +
    `📊 *آخر ${steps.length} إجراءات مسجلة (مرتبة زمنياً):*\n\n`;

  steps.forEach((s, idx) => {
    const tierIcon = s.performanceTier === 'RED_SLOW' ? '🔴' : s.performanceTier === 'YELLOW_ACCEPTABLE' ? '🟡' : '🟢';
    const timeStr = new Date(s.createdAt).toLocaleTimeString('ar-EG');
    const errText = s.errorMessage ? `\n   ⚠️ *خطأ:* \`${s.errorMessage.slice(0, 80)}\`` : '';

    text +=
      `*${idx + 1}.* [${timeStr}] ${tierIcon} \`${s.action}\`\n` +
      `   ⚡ زمن التنفيذ: *${s.executionTimeMs}ms* (${s.performanceTier})${errText}\n\n`;
  });

  return text;
}

export function formatUnresolvedErrorsList(total: number, page: number): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '⚡ الرقابة والأداء', '🛡️ التحقيق الجنائي', '🚨 الأعطال النشطة']) +
    `🚨 *كونسول الأعطال البرمجية النشطة (Unresolved Errors)*\n` +
    `────────────────────────────\n` +
    `إجمالي الأعطال المفتوحة غير المعالجة: *${total} عطل*\n` +
    `صفحة: *${page}*\n\n` +
    `اختر العطل للاطلاع على تفاصيل الخطأ ورمز التتبع (#ERR) واعتماد حله:`
  );
}

export function formatErrorDetailCard(err: UnresolvedErrorDto): string {
  const stack = err.stackTrace ? err.stackTrace.slice(0, 600) : 'لا يوجد Stack Trace مسجل';

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '⚡ الرقابة والأداء', '🛡️ التحقيق الجنائي', '🚨 تفاصيل العطل']) +
    `🚨 *تفاصيل العطل الجنائي: ${err.errorReference}*\n` +
    `────────────────────────────\n` +
    `🔹 *الخطورة:* *${err.severity}*\n` +
    `🔹 *مرات التكرار:* \`${err.occurrenceCount} مرة\`\n` +
    `🔹 *المستخدم:* \`${err.actorTelegramId || 'مجهول'}\` (${err.actorRole || 'GUEST'})\n` +
    `🔹 *الإجراء المسبب:* \`${err.actionTrigger || 'unknown'}\`\n` +
    `🔹 *المسار البرمجي:* \`${err.sourceLocation || 'unknown'}\`\n` +
    `🔹 *آخر ظهور:* \`${new Date(err.lastSeenAt).toLocaleString('ar-EG')}\`\n\n` +
    `📄 *نص رسالة الخطأ:*\n\`${err.errorMessage}\`\n\n` +
    `🔍 *تفاصيل الأثر التقني (Stack Snippet):*\n<blockquote expandable><code>${stack}</code></blockquote>\n` +
    `────────────────────────────\n` +
    `👇 *اضغط الزر أدناه بعد معالجة الخطأ برمجياً لإغلاقه وتدوين الإصلاح:*`
  );
}

export function formatPurgeSummary(res: PurgeResultDto): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '⚡ الرقابة والأداء', '🛡️ التحقيق الجنائي', '🧹 أرشفة السجلات']) +
    `🧹 *تقرير أرشفة وتطهير السجلات القديمة*\n` +
    `────────────────────────────\n` +
    `✅ *تم التطهير بنجاح:*\n` +
    `• سجلات الأعطال المحلولة المحذوفة (> 30 يوم): *${res.purgedErrorsCount} سجل*\n` +
    `• سجلات قياس الأداء APM المحذوفة (> 30 يوم): *${res.purgedPerformanceLogsCount} سجل*\n\n` +
    `تم تفريغ مساحة التخزين في PostgreSQL وتحديث الفهارس.`
  );
}
