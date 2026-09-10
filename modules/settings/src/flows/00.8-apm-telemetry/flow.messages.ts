import type { SlowOperationDto, ServicesHealthDto, ApmSummaryDto, AlertPolicyType } from './flow.types.js';

export function formatApmDashboard(summary: ApmSummaryDto, noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  return (
    `${banner}` +
    `📊 *رادار قياس الأداء والسرعة الفائقة (APM Telemetry)*\n` +
    `────────────────────────────\n` +
    `مؤشرات كفاءة واستجابة المنظومة خلال آخر 24 ساعة:\n\n` +
    `🔹 *إجمالي الحركات المعالجة:* \`${summary.totalOps24h} حركة\`\n` +
    `🔹 *متوسط زمن الاستجابة العام:* \`${summary.avgLatencyMs}ms\`\n` +
    `🔹 *نسبة الاستجابة الفائقة (< 50ms):* 🟢 \`${summary.greenPct}%\`\n` +
    `🔹 *نسبة الاستجابة المقبولة (50-250ms):* 🟡 \`${summary.yellowPct}%\`\n` +
    `🔹 *نسبة العمليات البطيئة (> 250ms):* 🔴 \`${summary.redPct}%\`\n` +
    `────────────────────────────\n` +
    `👇 *اختر شاشة التحليل المطلوبة:*`
  );
}

export function formatSlowOperationsList(ops: SlowOperationDto[]): string {
  if (ops.length === 0) {
    return (
      `⚡ *كاشف العمليات البطيئة (Slow Operations Radar)*\n` +
      `────────────────────────────\n` +
      `🟢 *ممتاز!* لم تسجل المنظومة أي عملية تجاوزت سقف 250ms خلال آخر 24 ساعة.`
    );
  }

  let text =
    `⚡ *كاشف العمليات البطيئة (أبطأ ${ops.length} عمليات > 250ms)*\n` +
    `────────────────────────────\n`;

  ops.forEach((op, idx) => {
    const timeStr = new Date(op.createdAt).toLocaleTimeString('ar-EG');
    const err = op.errorMessage ? `\n   ⚠️ *خطأ:* \`${op.errorMessage.slice(0, 60)}\`` : '';

    text +=
      `*${idx + 1}.* 🔴 \`${op.action}\`\n` +
      `   ⏱️ الزمن: *${op.executionTimeMs}ms* | الوقت: \`${timeStr}\` | المستخدم: \`${op.actorTelegramId}\`${err}\n\n`;
  });

  return text;
}

export function formatServicesHealthCard(health: ServicesHealthDto): string {
  const pgIcon = health.postgresStatus === 'HEALTHY' ? '🟢 سليم' : '🔴 متوقف';
  const redisIcon = health.redisStatus === 'HEALTHY' ? '🟢 سليم' : '🔴 متوقف';
  const tgIcon = health.telegramStatus === 'HEALTHY' ? '🟢 فائق' : '🟡 بطيء';
  const geminiIcon = health.geminiStatus === 'HEALTHY' ? '🟢 متصل' : '⚠️ غير متاح';

  return (
    `📊 *لوحة مراقبة الربط والخدمات الخارجية (Services Health)*\n` +
    `────────────────────────────\n` +
    `نتائج الفحص الحي بنقرة واحدة:\n\n` +
    `🐘 *قاعدة بيانات PostgreSQL:* ${pgIcon} (\`${health.postgresLatencyMs}ms\`)\n` +
    `⚡ *كاش الذاكرة Redis:* ${redisIcon} (\`${health.redisLatencyMs}ms\` | الذاكرة: \`${health.redisMemoryUsed}\`)\n` +
    `🤖 *خوادم Telegram Bot API:* ${tgIcon} (\`${health.telegramLatencyMs}ms\`)\n` +
    `🧠 *محرك الذكاء الاصطناعي Gemini API:* ${geminiIcon} (\`${health.geminiLatencyMs}ms\`)\n` +
    `────────────────────────────\n` +
    `🕒 *وقت الفحص:* \`${new Date(health.checkedAt).toLocaleTimeString('ar-EG')}\``
  );
}

export function formatAlertPolicyCard(currentPolicy: AlertPolicyType): string {
  const policyDescriptions: Record<AlertPolicyType, string> = {
    IMMEDIATE: '⚡ حساسية فورية: يتم إرسال إشعار فوري للسوبر أدمن عن أي خطأ مهما كانت درجة خطورته.',
    SMART: '🧠 حساسية ذكية (المعيار الموصى به): إشعارات للأخطاء الحرجة فقط مع ترشيد التكرار عند محطات 5x و 10x.',
    DAILY_DIGEST: '🌙 التقرير المجمع الصامت: إيقاف الإشعارات اللحظية وإرسال تقرير مسائي مجمع بملخص الأخطاء.',
  };

  return (
    `🔔 *ضبط حساسية وتوجيه إنذارات الأعطال*\n` +
    `────────────────────────────\n` +
    `السياسة المعتمدة حالياً: *${currentPolicy}*\n\n` +
    `${policyDescriptions[currentPolicy]}\n\n` +
    `اختر السياسة المطلوبة لتحديث وتيرة التنبيهات:`
  );
}
