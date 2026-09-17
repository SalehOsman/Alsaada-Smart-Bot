import { formatBreadcrumbs } from '@alsaada/core-components';
import { formatCurrency, normalizeDigits } from '@alsaada/regional-engine';
import type { DepartmentDto, JobTitleDto, MatrixImportResult } from './flow.types.js';

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
    `📊 *إجمالي الأقسام:* ${normalizeDigits(String(depts.length))} قسم\n\n` +
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
    `🔹 *إجمالي المسميات الوظيفية:* ${normalizeDigits(String(jobs.length))} مهنة (${normalizeDigits(String(dept.activeJobsCount))} نشطة)\n\n` +
    `👇 *قائمة الوظائف والمهن التابعة للقسم:*`
  );
}

export function formatJobDetailCard(job: JobTitleDto, noticeText?: string): string {
  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  const statusText = job.isActive ? '🟢 نشطة ومعتمدة' : '🔴 مجمدة مؤقتاً';
  const grossSalary = job.baseSalary + job.allowance;

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '💼 المهن', job.title]) +
    `${banner}` +
    `👷 *بطاقة المهنة: ${job.title}*\n` +
    `────────────────────────────\n` +
    `🔹 *كود الوظيفة:* \`${job.code}\`\n` +
    `🔹 *القسم التابع له:* \`${job.departmentName} (${job.departmentCode})\`\n` +
    `🔹 *الحالة التشغيلية:* ${statusText}\n` +
    `🔹 *الراتب الأساسي الشهري:* \`${formatCurrency(job.baseSalary)}\`\n` +
    `🔹 *الراتب الإضافي الشهري:* \`${formatCurrency(job.allowance)}\`\n` +
    `🔹 *إجمالي الراتب الشهري:* \`${formatCurrency(grossSalary)}\`\n` +
    `🔹 *حد كفاية الموقع المطلوب:* \`${normalizeDigits(String(job.minHeadcount))} عامل\`\n` +
    `🔹 *دورة العمل الافتراضية:* \`${normalizeDigits(String(job.workDays))} يوم عمل / ${normalizeDigits(String(job.restDays))} أيام راحة\`\n` +
    `🔹 *العمالة الفعلية المسجلة بالمهنة:* \`${normalizeDigits(String(job.workerCount ?? 0))} عامل\`\n` +
    `────────────────────────────\n` +
    `👇 *خيارات الإدارة والتعديل:*`
  );
}

export function formatSalaryPrompt(job: JobTitleDto, field: 'base' | 'add'): string {
  const fieldName = field === 'base' ? 'الراتب الأساسي' : 'الراتب الإضافي';
  const currentVal = field === 'base' ? job.baseSalary : job.allowance;
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '💼 المهن', job.title, `💰 تعديل ${fieldName}`]) +
    `💰 *تعديل ${fieldName} للمهنة: ${job.title}*\n` +
    `────────────────────────────\n` +
    `القيمة الحالية: \`${formatCurrency(currentVal)}\`\n\n` +
    `💬 *يرجى إرسال قيمة ${fieldName} الجديد بالأرقام (ج.م):*\n` +
    `(مثال: 8000 أو 2500)`
  );
}

export function formatSalaryPolicyPrompt(job: JobTitleDto, field: 'base' | 'add', newAmount: number): string {
  const fieldName = field === 'base' ? 'الراتب الأساسي' : 'الراتب الإضافي';
  const currentVal = field === 'base' ? job.baseSalary : job.allowance;
  const count = job.workerCount ?? 0;
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '💼 المهن', job.title, 'سياسة السريان']) +
    `⚖️ *تحديد سياسة سريان تعديل ${fieldName}*\n` +
    `────────────────────────────\n` +
    `المهنة: *${job.title}*\n` +
    `• القيمة السابقة: \`${formatCurrency(currentVal)}\`\n` +
    `• القيمة الجديدة: \`${formatCurrency(newAmount)}\`\n` +
    `• عدد العمال الحاليين المسجلين بالمهنة: \`${normalizeDigits(String(count))} عامل\`\n\n` +
    `اختر نطاق وسياسة تطبيق التعديل:`
  );
}

export function formatCyclePresetsPrompt(job: JobTitleDto): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '💼 المهن', job.title, '⏱️ دورة العمل']) +
    `⏱️ *إعداد دورة العمل والورديات للمهنة*\n` +
    `────────────────────────────\n` +
    `المهنة: *${job.title}*\n` +
    `الدورة الحالية: \`${normalizeDigits(String(job.workDays))} عمل / ${normalizeDigits(String(job.restDays))} إجازة\`\n\n` +
    `اختر نموذج الدورة القياسي المطلوب تطبيقه من الخيارات أدناه:`
  );
}

export function formatCyclePolicyPrompt(job: JobTitleDto, workDays: number, restDays: number): string {
  const count = job.workerCount ?? 0;
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان والمشاريع', '💼 المهن', job.title, 'سريان الدورة']) +
    `⏱️ *تحديد سياسة سريان تعديل دورة العمل*\n` +
    `────────────────────────────\n` +
    `المهنة: *${job.title}*\n` +
    `• الدورة السابقة: \`${normalizeDigits(String(job.workDays))} عمل / ${normalizeDigits(String(job.restDays))} إجازة\`\n` +
    `• الدورة الجديدة: \`${normalizeDigits(String(workDays))} عمل / ${normalizeDigits(String(restDays))} إجازة\`\n` +
    `• عدد العمال الحاليين بالمهنة: \`${normalizeDigits(String(count))} عامل\`\n\n` +
    `اختر نطاق التطبيق:`
  );
}

export function formatUploadPromptCard(): string {
  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان المؤسسي والمشاريع', '💼 مصفوفة المهن', '📤 استيراد إكسيل']) +
    `📤 *رفع وتحديث مصفوفة الأقسام والمهن (Excel)*\n` +
    `────────────────────────────\n` +
    `يرجى إرسال ملف الإكسيل بصيغة (\`.xlsx\`) كمستند في هذه المحادثة.\n\n` +
    `💡 *إرشادات الملف:*\n` +
    `• استخدم القالب الرسمي المحمّل من زر «📥 تنزيل قالب إكسيل الرسمي» لضمان التوافق.\n` +
    `• يجب أن يتضمن الملف عمود «الراتب الإضافي (ج.م)» وأيام العمل بين 1 و 60 يوماً.\n` +
    `• يتم إدراج الأقسام والمسميات الوظيفية الجديدة وتحديث القائمة تلقائياً.\n` +
    `• يمكنك التراجع في أي وقت بالضغط على زر «❌ إلغاء وتراجع» أدناه.`
  );
}

export function formatUploadResultCard(result: MatrixImportResult): string {
  if (!result.success) {
    const errorText = result.errors.slice(0, 6).map((e) => `• ${e}`).join('\n');
    const extraCount = result.errors.length > 6 ? `\n_...وهناك ${result.errors.length - 6} أخطاء أخرى._` : '';
    return (
      formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان المؤسسي والمشاريع', '💼 مصفوفة المهن', '❌ خطأ استيراد']) +
      `❌ *تعذر استيراد ملف الإكسيل*\n` +
      `────────────────────────────\n` +
      `${errorText}${extraCount}\n\n` +
      `يرجى مراجعة محتوى الملف والتأكد من مطابقة الأعمدة والقالب الرسمي ثم إعادة المحاولة.`
    );
  }

  return (
    formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان المؤسسي والمشاريع', '💼 مصفوفة المهن', '✅ تقرير الاستيراد']) +
    `✅ *تم استيراد وتحديث مصفوفة المهن بنجاح!*\n` +
    `────────────────────────────\n` +
    `🏢 *الأقسام المحدثة/المدرجة:* \`${normalizeDigits(String(result.departmentsUpserted))} قسم\`\n` +
    `💼 *الوظائف المحدثة/المدرجة:* \`${normalizeDigits(String(result.jobsUpserted))} مهنة\`\n\n` +
    `📊 أصبحت المسميات الوظيفية ودورات العمل جاهزة للاستخدام في المنظومة وبوت التعيينات.`
  );
}
