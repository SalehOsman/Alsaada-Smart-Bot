import { InlineKeyboard } from 'grammy';
import type { DepartmentDto, JobTitleDto, ShiftCycleOption } from './flow.types.js';

export function buildDepartmentsListKeyboard(depts: DepartmentDto[], isImpersonating?: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  depts.forEach((dept) => {
    const statusIcon = dept.isActive ? '🟢' : '🔴';
    keyboard
      .text(`${statusIcon} ${dept.name} (${dept.code}) — 💼 ${dept.activeJobsCount}/${dept.jobsCount}`, `action:dept:view:${dept.code}`)
      .row();
  });

  keyboard
    .text('➕ إضافة قسم وظيفي جديد', 'action:dept:add')
    .row()
    .text('📥 تنزيل قالب إكسيل الرسمي', 'action:dept:download_excel')
    .text('📤 رفع وتحديث مصفوفة إكسيل', 'action:dept:upload_excel')
    .row()
    .text('🔙 العودة للكيان المؤسسي', 'action:settings_sub:corporate')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildDepartmentDetailKeyboard(dept: DepartmentDto, jobs: JobTitleDto[], isImpersonating?: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  jobs.forEach((job) => {
    const statusIcon = job.isActive ? '🟢' : '🔴';
    keyboard
      .text(`${statusIcon} ${job.title} (${job.code}) — 👥 ${job.workerCount ?? 0}`, `action:job:view:${dept.code}:${job.code}`)
      .row();
  });

  keyboard
    .text('➕ إضافة مهنة / مسمى جديد بالقسم', `action:job:add:${dept.code}`)
    .row()
    .text('✏️ تعديل كود القسم', `action:dept:edit_code:${dept.code}`)
    .text('✏️ تعديل مسمى القسم', `action:dept:edit_name:${dept.code}`)
    .row()
    .text(dept.isActive ? '⏸️ تجميد القسم' : '▶️ تنشيط القسم', `action:dept:toggle_active:${dept.code}`)
    .row()
    .text('🔙 العودة لقائمة الأقسام', 'action:settings:job_matrix')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildJobDetailKeyboard(job: JobTitleDto, isImpersonating?: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('➖ تقليل حد الموقع (-1)', `action:job:headcount:${job.departmentCode}:${job.code}:dec`)
    .text(`حد الكفاية: ${job.minHeadcount}`, 'action:noop')
    .text('➕ زيادة حد الموقع (+1)', `action:job:headcount:${job.departmentCode}:${job.code}:inc`)
    .row()
    .text('⏱️ ضبط دورة العمل والورديات', `action:job:edit_cycle:${job.departmentCode}:${job.code}`)
    .row()
    .text('💰 تعديل الراتب الأساسي', `action:job:edit_salary:${job.departmentCode}:${job.code}`)
    .text('➕ تعديل الراتب الإضافي', `action:job:edit_add_salary:${job.departmentCode}:${job.code}`)
    .row()
    .text('✏️ تعديل المسمى الوظيفي', `action:job:edit_title:${job.departmentCode}:${job.code}`)
    .text(job.isActive ? '⏸️ تجميد المهنة' : '▶️ تنشيط المهنة', `action:job:toggle_active:${job.departmentCode}:${job.code}`)
    .row()
    .text('🔙 العودة للقسم التابع له', `action:dept:view:${job.departmentCode}`)
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildCyclePresetsKeyboard(deptCode: string, jobCode: string, cycles: ShiftCycleOption[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  cycles.forEach((c) => {
    const workQty = c.workDays;
    const restQty = c.restDays;
    keyboard
      .text(`⚡ ${workQty} عمل / ${restQty} إجازة`, `action:job:cycle_choice:${deptCode}:${jobCode}:${workQty}:${restQty}`)
      .row();
  });

  keyboard
    .text('✍️ إدخال يدوي مخصص', `action:job:cycle_custom:${deptCode}:${jobCode}`)
    .row()
    .text('🔙 العودة لبطاقة الوظيفة', `action:job:view:${deptCode}:${jobCode}`);
  return keyboard;
}

export function buildSalaryPolicyKeyboard(
  deptCode: string,
  jobCode: string,
  field: 'base' | 'add',
  amount: number
): InlineKeyboard {
  return new InlineKeyboard()
    .text('🆕 المعينون الجدد فقط', `action:job:spol:${deptCode}:${jobCode}:${field}:${amount}:NEW_HIRES_ONLY`)
    .row()
    .text('👥 تطبيق على جميع العاملين الحاليين بالوظيفة', `action:job:spol:${deptCode}:${jobCode}:${field}:${amount}:ALL_ACTIVE_WORKERS`)
    .row()
    .text('🔙 إلغاء وتراجع', `action:job:view:${deptCode}:${jobCode}`);
}

export function buildCyclePolicyKeyboard(
  deptCode: string,
  jobCode: string,
  workDays: number,
  restDays: number
): InlineKeyboard {
  const workQty = workDays;
  const restQty = restDays;
  return new InlineKeyboard()
    .text('🆕 المعينون الجدد فقط', `action:job:cpol:${deptCode}:${jobCode}:${workQty}:${restQty}:NEW_HIRES_ONLY`)
    .row()
    .text('👥 تطبيق على العاملين مع الدورة القادمة', `action:job:cpol:${deptCode}:${jobCode}:${workQty}:${restQty}:NEXT_CYCLE`)
    .row()
    .text('🔙 إلغاء وتراجع', `action:job:view:${deptCode}:${jobCode}`);
}

export function buildCancelEditKeyboard(deptCode: string, jobCode: string): InlineKeyboard {
  return new InlineKeyboard().text('❌ إلغاء وتراجع', `action:job:view:${deptCode}:${jobCode}`);
}

export function buildPolicyTransitionKeyboard(deptCode: string, jobCode: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('⚡ تطبيق فوري مع احتساب نسبي (Pro-Rata)', `action:job:apply_policy:${deptCode}:${jobCode}:IMMEDIATE_PRO_RATA`)
    .row()
    .text('📅 بدء السريان مع الدورة التالية تلقائياً', `action:job:apply_policy:${deptCode}:${jobCode}:NEXT_CYCLE_START`)
    .row()
    .text('🔙 العودة لبطاقة الوظيفة', `action:job:view:${deptCode}:${jobCode}`);
}

export function buildUploadPromptKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('❌ إلغاء وتراجع', 'action:dept:cancel_upload')
    .row()
    .text('🔙 العودة لقائمة الأقسام', 'action:settings:job_matrix');
}

export function buildUploadResultKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💼 عرض مصفوفة الأقسام والوظائف', 'action:settings:job_matrix')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}
