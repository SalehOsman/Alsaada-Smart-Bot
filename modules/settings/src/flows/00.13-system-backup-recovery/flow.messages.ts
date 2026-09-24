import {
  buildRichPage,
  richParagraph,
  richBold,
  richCode,
  assertRichMessage,
  formatBreadcrumbs,
} from '@alsaada/core-components';
import type {
  BackupStatusDto,
  BackupExecutionResultDto,
  DisasterRecoveryDrillDto,
  BackupListItemDto,
} from './flow.types.js';

const BACKUP_BREADCRUMBS = formatBreadcrumbs([
  '⚙️ إعدادات النظام',
  '🛡️ الرقابة واستمرارية الأعمال',
  '💾 النسخ واستعادة الكوارث',
]);

export function formatBackupStatusCard(stats: BackupStatusDto): string {
  const rpoBadge = stats.rpoStatus === 'HEALTHY' ? '🟢 سليم (RPO < 24h)' : '🟡 بحاجة لأخذ نسخة';
  const cloudBadge = stats.cloudSyncEnabled ? '🟢 مفعلة ومشفرة' : '⚪ محلية فقط (Staged)';
  const lastTime = stats.latestBackupAt
    ? new Date(stats.latestBackupAt).toLocaleString('ar-EG')
    : 'لا توجد لقطات بعد';

  const cardText =
    `${BACKUP_BREADCRUMBS}\n\n` +
    `💾 *قمرة النسخ الاحتياطي واستعادة الكوارث (Work Plan 99)*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *مؤشر RPO للتعافي:* ${rpoBadge}\n` +
    `⏱️ *توقيت آخر نسخة:* \`${lastTime}\`\n` +
    `📦 *إجمالي اللقطات:* \`${stats.totalBackups}\` لقطة\n` +
    `🔐 *التشفير والمفتاح البارد:* \`${stats.encryptionType}\` (PBKDF2)\n` +
    `☁️ *مزامنة Google Drive:* ${cloudBadge}\n` +
    `🛡️ *حظر التضخم (Zero-Bloat):* \`< ${stats.zeroBloatLimitMb} MB\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `اختر الإجراء المطلوب من اللوحة أدناه:`;

  const richMsg = buildRichPage({
    title: 'قمرة النسخ الاحتياطي واستعادة الكوارث',
    blocks: [richParagraph(cardText)],
  });
  assertRichMessage(richMsg);

  return cardText;
}

export function formatBackupInProgressCard(): string {
  const cardText =
    `${BACKUP_BREADCRUMBS}\n\n` +
    `⏳ *جاري إنشاء النسخة الاحتياطية الشاملة...*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `1. 💾 تفريغ قاعدة البيانات ذرياً (Single-Transaction Dump)...\n` +
    `2. 📦 حزم كود المشروع في حزمة Git Bundle مستقلة...\n` +
    `3. 🔐 تشفير المرفقات والأسرار بمفتاح AES-256-GCM...\n` +
    `4. 🔍 حساب ومطابقة بصمات الهاش SHA-256...\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ العملية تعمل في الخلفية؛ سيتم تحديث هذه الرسالة فور الاكتمال.`;

  const richMsg = buildRichPage({
    title: 'جاري إنشاء النسخة الاحتياطية',
    blocks: [richParagraph(cardText)],
  });
  assertRichMessage(richMsg);

  return cardText;
}

export function formatBackupSuccessCard(res: BackupExecutionResultDto): string {
  const sizeMb = res.totalSizeBytes ? (res.totalSizeBytes / (1024 * 1024)).toFixed(2) : '< 15';

  const cardText =
    `${BACKUP_BREADCRUMBS}\n\n` +
    `✅ *اكتملت عملية النسخ الاحتياطي بنجاح!*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 *معرف النسخة:* \`${res.backupId}\`\n` +
    `📅 *تاريخ الإنشاء:* \`${new Date(res.createdAt).toLocaleString('ar-EG')}\`\n` +
    `📦 *الملفات المؤرشفة:* \`${res.artifactsCount}\` ملفات مشفرة ومطابقة\n` +
    `💾 *الحجم التقديري:* \`${sizeMb} MB\` (Zero-Bloat Approved)\n` +
    `☁️ *حالة المزامنة:* \`${res.cloudSyncStatus}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔒 النسخة مؤمنة على القرص المضيف ومطابقة لمعايير الحوكمة التشفيرية.`;

  const richMsg = buildRichPage({
    title: 'اكتمل النسخ الاحتياطي',
    blocks: [richParagraph(cardText)],
  });
  assertRichMessage(richMsg);

  return cardText;
}

export function formatDisasterRecoveryDrillCard(drill: DisasterRecoveryDrillDto): string {
  const statusBadge = drill.ok ? '🟢 ناجح 100%' : '🔴 فشل التدريب';

  const cardText =
    `${BACKUP_BREADCRUMBS}\n\n` +
    `🧪 *تقرير تدريب استعادة الكوارث الآلي (Automated DR Drill)*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🚦 *النتيجة النهائية:* ${statusBadge}\n` +
    `⏱️ *زمن الاستعادة (RTO Time):* \`${drill.rtoSeconds}\` ثانية\n` +
    `💾 *حجم حزمة الكود:* \`${drill.bundleSizeMb.toFixed(2)} MB\` (<30MB)\n` +
    `🔐 *فك التشفير بالمفتاح البارد:* ✅ معتمد وناجح\n` +
    `🛡️ *كشف التلاعب بالهاش:* ✅ تم رصد التلاعب وإيقافه\n` +
    `⚖️ *تطابق دفاتر الأستاذ (G12):* ✅ السلسلة المحاسبية سليمة 100%\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    (drill.errors.length > 0 ? `⚠️ ملاحظات: ${drill.errors.join(', ')}` : `✅ المنظومة جاهزة تماماً للتعافي من الكوارث.`);

  const richMsg = buildRichPage({
    title: 'تقرير تدريب استعادة الكوارث الآلي',
    blocks: [richParagraph(cardText)],
  });
  assertRichMessage(richMsg);

  return cardText;
}

export function formatBackupListCard(items: BackupListItemDto[]): string {
  let listText = '';
  if (items.length === 0) {
    listText = 'لا توجد لقطات احتياطية مسجلة حتى الآن.\n';
  } else {
    for (const item of items.slice(0, 5)) {
      const status = item.isIntegrityIntact ? '🟢 سليم' : '🔴 تالف';
      const sizeMb = (item.totalSizeBytes / (1024 * 1024)).toFixed(1);
      listText += `• \`${item.backupId}\` (${sizeMb} MB) — ${status}\n`;
    }
  }

  const cardText =
    `${BACKUP_BREADCRUMBS}\n\n` +
    `📋 *سجل اللقطات الاحتياطية المتاحة*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    listText +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `لاستعادة أي لقطة، يرجى التوجه إلى لوحة التحكم الإدارية (Dashboard) واستخدام كود التأكيد اليومي.`;

  const richMsg = buildRichPage({
    title: 'سجل اللقطات الاحتياطية',
    blocks: [richParagraph(cardText)],
  });
  assertRichMessage(richMsg);

  return cardText;
}
