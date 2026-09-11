import { formatBreadcrumbs } from '@alsaada/core-components';
import type { DepartmentDto, JobTitleDto } from './flow.types.js';

export function formatDepartmentsListCard(depts: DepartmentDto[], noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان المؤسسي والمشاريع', '💼 مصفوفة المهن']) +
    `${banner}` +
    `💼 *الهيكل الوظيفي ومصفوفة الأقسام والمهن*\n` +
    `────────────────────────────\n` +
    `دليل الأقسام التشغيلية والإدارية ومسميات الوظائف ودورات العمل المعيارية.\n` +
    `📊 *إجمالي الأقسام:* ${depts.length} قسم\n\n` +
    `👇 *اختر القسم المطلوب لإدارة وظائفه أو استخدم أزرار إكسيل أدناه:*`
  );
}

export function formatDepartmentDetailCard(dept: DepartmentDto, jobs: JobTitleDto[], noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  const statusText = dept.isActive ? '🟢 نشط' : '🔴 مجمد';

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '💼 الأقسام', dept.name]) +
    `${banner}` +
    `💼 *قسم: ${dept.name} (${dept.code})*\n` +
    `────────────────────────────\n` +
    `🔹 *الحالة التشغيلية:* ${statusText}\n` +
    `🔹 *إجمالي المسميات الوظيفية:* ${jobs.length} مهنة (${dept.activeJobsCount} نشطة)\n\n` +
    `👇 *قائمة الوظائف والمهن التابعة للقسم:*`
  );
}

export function formatJobDetailCard(job: JobTitleDto, noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  const statusText = job.isActive ? '🟢 نشطة ومعتمدة' : '🔴 مجمدة مؤقتاً';

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '💼 المهن', job.title]) +
    `${banner}` +
    `👷 *بطاقة المهنة: ${job.title}*\n` +
    `────────────────────────────\n` +
    `🔹 *كود الوظيفة:* \`${job.code}\`\n` +
    `🔹 *القسم التابع له:* \`${job.departmentName} (${job.departmentCode})\`\n` +
    `🔹 *الحالة التشغيلية:* ${statusText}\n` +
    `🔹 *الراتب الافتراضي:* \`${job.baseSalary.toLocaleString('ar-EG')} ج.م\`\n` +
    `🔹 *حد كفاية الموقع المطلوب:* \`${job.minHeadcount} عامل\`\n` +
    `🔹 *دورة العمل الافتراضية:* \`${job.workDays} يوم عمل / ${job.restDays} أيام راحة\`\n` +
    `🔹 *العمالة الفعلية المسجلة بالمهنة:* \`${job.workerCount ?? 0} عامل\`\n` +
    `────────────────────────────\n` +
    `👇 *خيارات الإدارة والتعديل:*`
  );
}

export function formatCyclePresetsPrompt(job: JobTitleDto): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '💼 المهن', job.title, '⏱️ دورة العمل']) +
    `⏱️ *إعداد دورة العمل والورديات للمهنة*\n` +
    `────────────────────────────\n` +
    `المهنة: *${job.title}*\n` +
    `الدورة الحالية: \`${job.workDays} عمل / ${job.restDays} إجازة\`\n\n` +
    `اختر نموذج الدورة القياسي المطلوب تطبيقه من الأنماط السريعة أدناه:`
  );
}
