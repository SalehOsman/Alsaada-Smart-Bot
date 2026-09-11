import {
  formatBreadcrumbs,
  formatClickToCopy,
} from '@alsaada/core-components';
import type {
  UserDetailDto,
  WorkerCandidateDto,
  DirectLinkResult,
  LiveProfilePreview,
} from './flow.types.js';
import { buildRoleBadge } from './flow.keyboard.js';

const RBAC_BREADCRUMBS = formatBreadcrumbs([
  '⚙️ إعدادات النظام',
  '🔐 الهوية وإدارة الصلاحيات',
  '👥 إدارة المستخدمين والأدوار',
]);

export function formatUserDirectoryHeader(total: number, page: number, totalPages: number): string {
  return (
    `${RBAC_BREADCRUMBS}\n\n` +
    `👥 *دليل مستخدمي وأعضاء المنظومة (User RBAC Directory)*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *إجمالي الأعضاء المسجلين:* \`${total}\` عضو\n` +
    `📄 *الصفحة الحالية:* \`${page}\` من \`${totalPages}\`\n\n` +
    `اختر أي عضو من القائمة أدناه لإدارة رتبته أو تعديل صلاحياته:`
  );
}

export function formatUserDetailCard(user: UserDetailDto): string {
  const roleBadge = buildRoleBadge(user.role);
  const statusBadge = user.isBanned
    ? '🔴 محظور ومجمد'
    : user.isActive
      ? '🟢 نشط ومفوض'
      : '⚪ غير مفعل';

  let relationInfo = '';
  if (user.workerId) {
    relationInfo = `👷 *ملف العامل المربوط:* ${user.workerName || 'عامل'} (\`#${user.workerCode || ''}\`)\n`;
  }
  if (user.assignedSiteId) {
    relationInfo += `📍 *الموقع الميداني المخصص:* ${user.assignedSiteName || 'موقع محدد'}\n`;
  }

  return (
    `${RBAC_BREADCRUMBS}\n\n` +
    `📇 *بطاقة تحكم العضوية 360°*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *الاسم الكامل:* ${user.fullName}\n` +
    `🔹 *المعرف الرقمي:* ${formatClickToCopy(user.telegramId.toString())}\n` +
    `🔹 *معرف المستخدم:* @${user.username || 'بدون معرف'}\n` +
    `🎖️ *الرتبة والصلاحية:* ${roleBadge}\n` +
    `🚦 *الحالة التشغيلية:* ${statusBadge}\n` +
    relationInfo +
    `📅 *تاريخ التسجيل:* \`${user.createdAt.toLocaleDateString('ar-EG')}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `اختر الإجراء الإداري المطلوب تنفيذه:`
  );
}

export function formatPromptEnterTelegramId(worker: WorkerCandidateDto): string {
  const name = worker.nickname || worker.name;
  return (
    `${RBAC_BREADCRUMBS}\n\n` +
    `👷 *ربط العامل بحساب تيليجرام مباشر*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *العامل:* ${name} (\`#${worker.code}\`)\n` +
    `📍 *الموقع:* ${worker.siteName || 'الموقع العام'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `⌨️ *أدخل الآن معرف التليجرام الرقمي (Telegram ID) الخاص بالعامل:*\n` +
    `_(مثال: \`7594239391\` — يمكنك إدخال الأرقام بالإنجليزية أو العربية)_\n\n` +
    `💡 *ملاحظة:* إذا لم يكن العامل قد دخل البوت من قبل، سيتم إنشاء حسابه مسبقاً وتفعيله تلقائياً فور أول زيارة.`
  );
}

export function formatLivePreviewCard(
  worker: WorkerCandidateDto,
  preview: LiveProfilePreview
): string {
  const workerName = worker.nickname || worker.name;
  const tgName = [preview.firstName, preview.lastName].filter(Boolean).join(' ') || 'مستخدم تيليجرام';
  const tgUser = preview.username ? `@${preview.username}` : 'بدون اسم مستخدم';

  return (
    `${RBAC_BREADCRUMBS}\n\n` +
    `🔍 *رادار التحقق اللحظي من هوية تليجرام*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *اسم العامل بالشركة:* ${workerName} (\`#${worker.code}\`)\n` +
    `📱 *صاحب حساب التليجرام:* ${tgName} (${tgUser})\n` +
    `🆔 *المعرف الرقمي:* ${formatClickToCopy(preview.telegramId.toString())}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `هل تؤكد مطابقة هذا الحساب للعامل واعتماد ربطه بالمنظومة؟`
  );
}

export function formatConflictWarningCard(
  worker: WorkerCandidateDto,
  conflictWorkerName: string,
  telegramId: bigint
): string {
  const workerName = worker.nickname || worker.name;
  return (
    `${RBAC_BREADCRUMBS}\n\n` +
    `⚠️ *تحذير أمني: تعارض في معرف التليجرام!*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `المعرف الرقمي ${formatClickToCopy(telegramId.toString())} مربوط حالياً بالعامل:\n` +
    `⚠️ *[ ${conflictWorkerName} ]*\n\n` +
    `أنت الآن بصدد نقل الارتباط إلى العامل:\n` +
    `👷 *[ ${workerName} ]* (\`#${worker.code}\`)\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `عند التأكيد، سيتم **تجريد الحساب القديم تلقائياً** وتنزيل رتبته إلى زائر \`GUEST\` وفك ربطه منعاً لتداخل البيانات.\n\n` +
    `هل تريد المتابعة وتأكيد نقل الارتباط؟`
  );
}

export function formatDirectLinkSuccess(res: DirectLinkResult): string {
  let transferNote = '';
  if (res.reboundFromOldUser && res.oldWorkerName) {
    transferNote = `\n⚠️ *ملاحظة:* تم فك ارتباط العامل السابق (${res.oldWorkerName}) وتنزيل حسابه لزائر.\n`;
  }

  return (
    `${RBAC_BREADCRUMBS}\n\n` +
    `🎉 *تم ربط وتفويض العامل بنجاح 100%!*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *العامل المعتمد:* ${res.workerName} (\`#${res.workerCode}\`)\n` +
    `🆔 *معرف التليجرام:* ${formatClickToCopy(res.telegramId.toString())}\n` +
    `🎖️ *الصلاحية الممنوحة:* 👷 عامل (بوابة الخدمة الذاتية)\n` +
    `🟢 *حالة الحساب:* نشط ومعتمد مسبقاً` +
    transferNote +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `يمكن للعامل الآن فتح البوت والضغط على \`/start\` للبدء فورياً.`
  );
}

export function formatRoleChangedMessage(fullName: string, newRole: string): string {
  return (
    `✅ *تم تحديث رتبة وصلاحيات العضو بنجاح:*\n` +
    `👤 *العضو:* ${fullName}\n` +
    `🎖️ *الرتبة الجديدة:* ${buildRoleBadge(newRole)}`
  );
}
