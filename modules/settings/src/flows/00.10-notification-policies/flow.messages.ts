import { formatBreadcrumbs } from '@alsaada/core-components';
import type { DepartmentDetailDto, DepartmentPolicySummaryDto, PolicyScope } from './flow.types.js';

export function formatPoliciesHubMessage(): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '⚡ الرقابة', '🔔 سياسات الإشعارات']) +
    `🔔 *مركز حوكمة وضبط إشعارات المنظومة*\n` +
    `────────────────────────────\n` +
    `تحكم سيادي كامل ومستقل في توجيه وبث إشعارات العمليات الميدانية والتقارير التنفيذية:\n\n` +
    `🏗️ *جروبات المواقع الميدانية:* إشعارات مقروءة ومحددة لكل موقع، موجهة لمشرفي الموقع فقط.\n` +
    `🏢 *جروب الإدارة العليا:* تقارير مجمعة وإقفالات يومية مقسمة في 4 توبيكات تنفيذية متخصصة.\n\n` +
    `💡 *مبدأ الاستقلال التام:* تعطيل أو تشغيل أي وظيفة في جروبات المواقع لا يؤثر مطلقاً على إشعارات الإدارة العليا والعكس صحيح.\n\n` +
    `👇 *اختر المسار المراد ضبط سياساته:*`
  );
}

export function formatScopeDepartmentsMessage(
  scope: PolicyScope,
  departments: DepartmentPolicySummaryDto[]
): string {
  const scopeTitle =
    scope === 'site' ? 'جروبات المواقع الميدانية' : 'جروب الإدارة العليا والتقارير';
  const totalFeatures = departments.reduce((acc, d) => acc + d.totalFeatures, 0);
  const totalEnabled = departments.reduce((acc, d) => acc + d.enabledFeatures, 0);

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🔔 الإشعارات', scopeTitle]) +
    `🎛️ *ضبط سياسات إشعارات: ${scopeTitle}*\n` +
    `────────────────────────────\n` +
    `📊 *موجز التفعيل العام:* ${totalEnabled} من أصل ${totalFeatures} وظيفة مفعلة 🟢\n\n` +
    `اختر القسم التشغيلي للتحكم الدقيق في تفعيل وتعطيل إشعارات كل وظيفة على حدة، أو نمط الإشعار الصامت:`
  );
}

export function formatDepartmentDetailMessage(detail: DepartmentDetailDto): string {
  const scopeTitle = detail.scope === 'site' ? 'جروبات المواقع' : 'جروب الإدارة';

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🔔 الإشعارات', scopeTitle, detail.departmentLabel]) +
    `📂 *قسم: ${detail.departmentLabel}* (${scopeTitle})\n` +
    `────────────────────────────\n` +
    `اضغط على اسم الوظيفة للتبديل بين [ 🟢 مفعل ] و [ 🔴 معطل ].\n` +
    `اضغط على رمز الصوت للتبديل بين [ 🔔 برنين ] و [ 🔕 إشعار صامت ]:\n\n` +
    detail.features
      .map(
        (f) =>
          `├ ${f.enabled ? '🟢' : '🔴'} *${f.label}* — ${f.isSilent ? '🔕 صامت' : '🔔 صوت'}`
      )
      .join('\n')
  );
}
