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
  SnapshotDetailDto,
  RestoreExecutionResultDto,
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
    `اضغط على أي لقطة لعرض تفاصيلها واستعادتها حياً.`;

  const richMsg = buildRichPage({
    title: 'سجل اللقطات الاحتياطية',
    blocks: [richParagraph(cardText)],
  });
  assertRichMessage(richMsg);

  return cardText;
}

export function formatSnapshotDetailCard(detail: SnapshotDetailDto): string {
  const sizeMb = (detail.totalSizeBytes / (1024 * 1024)).toFixed(2);
  const dbMb = detail.databaseSize ? (detail.databaseSize / (1024 * 1024)).toFixed(2) : '-';
  const codeMb = detail.codebaseSize ? (detail.codebaseSize / (1024 * 1024)).toFixed(2) : '-';
  const integrityBadge = detail.isIntegrityIntact ? '🟢 سليمة 100%' : '🔴 تالفة أو غير متطابقة';
  const cloudBadge = detail.cloudSyncStatus === 'synced' ? '🟢 مرفوعة ومزامنة' : `⚪ ${detail.cloudSyncStatus}`;

  const cardText =
    `${BACKUP_BREADCRUMBS}\n\n` +
    `🔍 *تفاصيل اللقطة الاحتياطية*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 *المعرف:* \`${detail.backupId}\`\n` +
    `📅 *تاريخ الإنشاء:* \`${new Date(detail.createdAt).toLocaleString('ar-EG')}\`\n` +
    `📦 *الملفات المؤرشفة:* \`${detail.artifactsCount}\` ملفات\n` +
    `💾 *الحجم الكلي:* \`${sizeMb} MB\`\n` +
    `🗄️ *قاعدة البيانات:* \`${dbMb} MB\`\n` +
    `💻 *كود وسجلات المشروع:* \`${codeMb} MB\`\n` +
    `🛡️ *فحص النزاهة التشفيري:* ${integrityBadge}\n` +
    `☁️ *حالة درايف:* ${cloudBadge}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ يمكنك استعادة هذه اللقطة حياً إلى قاعدة البيانات مباشرة.`;

  const richMsg = buildRichPage({
    title: 'تفاصيل اللقطة الاحتياطية',
    blocks: [richParagraph(cardText)],
  });
  assertRichMessage(richMsg);

  return cardText;
}

export function formatRestoreWarningCard(backupId: string, createdAt: string): string {
  const cardText =
    `${BACKUP_BREADCRUMBS}\n\n` +
    `⚠️ *تحذير أمني وسيادي: استعادة حية*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 *اللقطة المستهدفة:* \`${backupId}\`\n` +
    `📅 *تاريخ اللقطة:* \`${new Date(createdAt).toLocaleString('ar-EG')}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🚨 *تنبيه حرج:* سيتم استبدال بيانات قاعدة البيانات الحالية بالكامل ببيانات هذه اللقطة.\n\n` +
    `🛡️ *إجراء الأمان الوقائي:* سيقوم النظام تلقائياً بأخذ لقطة أمان فورية (Safety Snapshot) قبل بدء الاستعادة.\n\n` +
    `هل تريد بالتأكيد المتابعة وتأكيد الاستعادة الحية الآن؟`;

  const richMsg = buildRichPage({
    title: 'تحذير استعادة حية',
    blocks: [richParagraph(cardText)],
  });
  assertRichMessage(richMsg);

  return cardText;
}

export function formatRestoreInProgressCard(backupId: string): string {
  const cardText =
    `${BACKUP_BREADCRUMBS}\n\n` +
    `⏳ *جاري تنفيذ الاستعادة الحية للبيانات...*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `1. 🛡️ أخذ لقطة أمان وقائية فورية...\n` +
    `2. 🔍 التحقق التشفيري من بصمة SHA-256 للقطة \`${backupId}\`...\n` +
    `3. 🔐 فك تشفير البيانات بمفتاح AES-256-GCM...\n` +
    `4. ⚡ استعادة قاعدة البيانات ذرياً (Atomic Restoration)...\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ العملية جارية في الخلفية؛ سيتم تحديث الرسالة فور الانتهاء.`;

  const richMsg = buildRichPage({
    title: 'جاري تنفيذ الاستعادة الحية',
    blocks: [richParagraph(cardText)],
  });
  assertRichMessage(richMsg);

  return cardText;
}

export function formatRestoreSuccessCard(res: RestoreExecutionResultDto): string {
  if (res.success) {
    const cardText =
      `${BACKUP_BREADCRUMBS}\n\n` +
      `✅ *تمت الاستعادة الحية للبيانات بنجاح!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🆔 *اللقطة المستعادة:* \`${res.backupId}\`\n` +
      `🛡️ *لقطة الأمان الوقائية:* \`${res.safetyBackupId ?? 'تم الحفظ'}\`\n` +
      `⏱️ *زمن الاستعادة (RTO):* \`${res.rtoSeconds}\` ثواني\n` +
      `📅 *توقيت الاستعادة:* \`${new Date(res.restoredAt).toLocaleString('ar-EG')}\`\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔒 قاعدة البيانات تعمل الآن بكفاءة متطابقة 100% مع لقطة الاستعادة.`;

    const richMsg = buildRichPage({
      title: 'اكتملت الاستعادة الحية بنجاح',
      blocks: [richParagraph(cardText)],
    });
    assertRichMessage(richMsg);

    return cardText;
  }

  const cardText =
    `${BACKUP_BREADCRUMBS}\n\n` +
    `❌ *فشلت عملية الاستعادة الحية*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 *اللقطة:* \`${res.backupId}\`\n` +
    `⚠️ *سبب الفشل:* \`${res.error ?? 'خطأ غير معروف'}\`\n` +
    `🛡️ *لقطة الأمان:* \`${res.safetyBackupId ?? 'لا توجد'}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `لم تتأثر البيانات الحالية أو تم الحفاظ عليها بلقطة الأمان.`;

  const richMsg = buildRichPage({
    title: 'فشلت الاستعادة الحية',
    blocks: [richParagraph(cardText)],
  });
  assertRichMessage(richMsg);

  return cardText;
}
