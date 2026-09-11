import { formatBreadcrumbs, formatClickToCopy } from '@alsaada/core-components';
import type { GroupHealthStatusDto, HqGroupStatusDto, SiteGroupItemDto } from './flow.types.js';

export function formatGroupsHubMessage(
  hqStatus: HqGroupStatusDto,
  sites: SiteGroupItemDto[]
): string {
  const boundSitesCount = sites.filter((s) => s.isBound).length;

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '🏛️ إدارة المجموعات']) +
    `🏛️ *مركز إدارة وربط مجموعات تيليجرام*\n` +
    `────────────────────────────\n` +
    `لوحة الربط والتحكم المركزي بمجموعات تيليجرام وتوجيه الإشعارات الميدانية والتنفيذية.\n\n` +
    `🏢 *جروب الإدارة العليا والعمليات المركزية:* ` +
    (hqStatus.isBound
      ? `🟢 مربوط (${formatClickToCopy(hqStatus.chatId || '')})\n` +
        `├ حالة التوبيكات: ${hqStatus.topicsConfigured ? '✅ مهيأة ومفعلة (4 مواضيع)' : '⚠️ بانتظار التهيئة'}\n`
      : `🔴 غير مربوط حالياً\n`) +
    `\n🏗️ *جروبات المواقع الميدانية:*\n` +
    `├ إجمالي المواقع النشطة: *${sites.length}* موقع\n` +
    `├ المواقع المربوطة بمجموعات: *${boundSitesCount}* موقع 🟢\n` +
    `└ المواقع غير المربوطة: *${sites.length - boundSitesCount}* موقع 🔴\n\n` +
    `👇 *اختر الإجراء المطلوب:*`
  );
}

export function formatHqDetailMessage(hqStatus: HqGroupStatusDto): string {
  const topicsList = hqStatus.topicsConfigured
    ? `├ 📊 الإقفالات اليومية: \`${hqStatus.topics.siteClosuresThreadId ?? '-'}\`\n` +
      `├ 💰 ملخصات الرواتب والسلف: \`${hqStatus.topics.financialDigestsThreadId ?? '-'}\`\n` +
      `├ 🚚 تقارير الشحن والمحروقات: \`${hqStatus.topics.logisticsFuelThreadId ?? '-'}\`\n` +
      `└ 📢 التوجيهات والقرارات: \`${hqStatus.topics.executiveDecreesThreadId ?? '-'}\``
    : `└ ⚠️ لم يتم إنشاء وتكويد التوبيكات حتى الآن.`;

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏛️ المجموعات', '🏢 جروب الإدارة العليا']) +
    `🏢 *إدارة جروب الإدارة العليا والتقارير التنفيذية*\n` +
    `────────────────────────────\n` +
    `هذه المجموعة مخصصة للمدير العام، مدراء العمليات والحسابات العامة لاستقبال التقارير والإقفالات اليومية المجمعة.\n\n` +
    `📌 *حالة الربط الحالية:* ${hqStatus.isBound ? '🟢 مربوط بنجاح' : '🔴 غير مربوط'}\n` +
    `🆔 *معرف المجموعة (Chat ID):* ${
      hqStatus.chatId ? formatClickToCopy(hqStatus.chatId) : '_غير محدد_'
    }\n\n` +
    `📑 *حالة التوبيكات الأربعة (Forum Topics):*\n` +
    `${topicsList}\n\n` +
    `💡 *ملاحظة:* يرجى التأكد من تفعيل خاصية "Topics" في إعدادات المجموعة بتيليجرام قبل تشغيل التهيئة التلقائية.`
  );
}

export function formatSitesMatrixMessage(sites: SiteGroupItemDto[]): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏛️ المجموعات', '🏗️ مصفوفة المواقع']) +
    `🏗️ *مصفوفة ربط مجموعات المواقع الميدانية*\n` +
    `────────────────────────────\n` +
    `لكل موقع ميداني مجموعة خاصة به، يتم فيها بث إشعارات التسجيل والعمليات اليومية المقروءة لمشرفي ذلك الموقع حصراً.\n\n` +
    `اختر الموقع المراد ضبط وإدارة مجموعة تيليجرام الخاصة به:`
  );
}

export function formatSiteDetailMessage(site: SiteGroupItemDto): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏛️ المجموعات', site.name]) +
    `🏗️ *إدارة مجموعة الموقع: ${site.name}*\n` +
    `────────────────────────────\n` +
    `🏷️ *كود الموقع:* \`${site.code}\`\n` +
    `📍 *المحافظة:* ${site.governorate}\n` +
    `👥 *العمال المسجلين:* ${site.workersCount} عامل\n` +
    `📌 *حالة الربط:* ${site.isBound ? '🟢 مربوط' : '🔴 غير مربوط'}\n` +
    `🆔 *معرف المجموعة (Chat ID):* ${
      site.telegramGroupId ? formatClickToCopy(site.telegramGroupId) : '_غير محدد_'
    }\n\n` +
    `🛡️ *إرشادات التشغيل:*\n` +
    `1. أضف البوت إلى مجموعة الموقع الميداني عبر الرابط أدناه.\n` +
    `2. قم بترقية البوت إلى مشرف (Admin) مع صلاحية إرسال الرسائل.\n` +
    `3. اضغط زر "فحص حالة الاتصال والصلاحيات" للتأكد من الجاهزية.`
  );
}

export function formatGroupHealthMessage(health: GroupHealthStatusDto): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏛️ المجموعات', '🧪 رادار الفحص']) +
    `🧪 *رادار تشخيص صحة اتصال وصلاحيات المجموعة*\n` +
    `────────────────────────────\n` +
    `🆔 *المعرف الرقمي:* ${formatClickToCopy(health.chatId)}\n` +
    (health.title ? `🏷️ *اسم المجموعة:* *${health.title}*\n` : '') +
    (health.type ? `📁 *نوع المحادثة:* \`${health.type}\`\n` : '') +
    `📑 *نظام المنتدى (Topics):* ${health.isForum ? '✅ مفعل' : '❌ معطل'}\n\n` +
    `🛡️ *مصفوفة صلاحيات البوت:*\n` +
    `├ إرسال الرسائل: ${health.canPostMessages ? '✅ مصرح' : '❌ غير مصرح'}\n` +
    `├ إدارة المواضيع (Topics): ${health.canManageTopics ? '✅ مصرح' : '❌ غير مصرح'}\n` +
    `└ حذف وإدارة الرسائل: ${health.canDeleteMessages ? '✅ مصرح' : '❌ غير مصرح'}\n\n` +
    `📢 *النتيجة التشخيصية:*\n${health.statusMessage}`
  );
}
