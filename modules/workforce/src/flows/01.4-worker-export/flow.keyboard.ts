import { InlineKeyboard } from 'grammy';
import { buildCompletionKeyboard } from '@alsaada/core-components';
import type { DepartmentSummary, JobTitleSummary } from './flow.types.js';

export class WorkerExportKeyboards {
  static templateDownloadKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📤 رفع الملف بعد التعبئة', 'action:worker:upload_excel')
      .row()
      .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr')
      .text('🏠 القائمة الرئيسية', 'action:main_menu');
  }

  static uploadPromptKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📥 تنزيل القالب المعتمد أولاً', 'action:worker:download_excel')
      .row()
      .text('❌ إلغاء العملية', 'action:cancel_worker_op')
      .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr');
  }

  static exportMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🌐 الكشف الكامل (كافة العاملين)', 'action:worker_export:do:all')
      .row()
      .text('🏢 تصفية حسب القسم الوظيفي', 'action:worker_export:dept_menu')
      .row()
      .text('💼 تصفية حسب المهنة / الوظيفة', 'action:worker_export:job_menu:1')
      .row()
      .text('📍 تصفية حسب المحافظة', 'action:worker_export:gov_menu')
      .row()
      .text('◀️ رجوع لقسم استيراد وتصدير الكشوف', 'menu:hr_sub:worker_excel')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');
  }

  static departmentFilterKeyboard(departments: DepartmentSummary[]): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (let i = 0; i < departments.length; i += 2) {
      const dept1 = departments[i];
      const dept2 = departments[i + 1];
      if (dept1) {
        kb.text(dept1.name, `action:worker_export:do:dept:${dept1.id}`);
      }
      if (dept2) {
        kb.text(dept2.name, `action:worker_export:do:dept:${dept2.id}`);
      }
      kb.row();
    }
    kb.text('◀️ رجوع لخيارات التصفية', 'action:worker_export:start');
    kb.row().text('🏠 القائمة الرئيسية', 'action:main_menu');
    return kb;
  }

  static jobTitleFilterKeyboard(
    jobs: JobTitleSummary[],
    page: number,
    totalPages: number
  ): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (let i = 0; i < jobs.length; i += 2) {
      const job1 = jobs[i];
      const job2 = jobs[i + 1];
      if (job1) {
        kb.text(job1.name, `action:worker_export:do:job:${job1.id}`);
      }
      if (job2) {
        kb.text(job2.name, `action:worker_export:do:job:${job2.id}`);
      }
      kb.row();
    }

    // Pagination controls
    const navRow = [];
    if (page > 1) {
      navRow.push({ text: '◀️ السابق', callback_data: `action:worker_export:job_menu:${page - 1}` });
    }
    if (page < totalPages) {
      navRow.push({ text: 'التالي ▶️', callback_data: `action:worker_export:job_menu:${page + 1}` });
    }
    if (navRow.length > 0) {
      for (const btn of navRow) {
        kb.text(btn.text, btn.callback_data);
      }
      kb.row();
    }

    kb.text('◀️ رجوع لخيارات التصفية', 'action:worker_export:start');
    kb.row().text('🏠 القائمة الرئيسية', 'action:main_menu');
    return kb;
  }

  static governorateFilterKeyboard(
    governorates: Record<string, string>
  ): InlineKeyboard {
    const kb = new InlineKeyboard();
    const entries = Object.entries(governorates);
    for (let i = 0; i < entries.length; i += 2) {
      const g1 = entries[i];
      const g2 = entries[i + 1];
      if (g1) {
        kb.text(g1[1], `action:worker_export:do:gov:${g1[0]}`);
      }
      if (g2) {
        kb.text(g2[1], `action:worker_export:do:gov:${g2[0]}`);
      }
      kb.row();
    }
    kb.text('◀️ رجوع لخيارات التصفية', 'action:worker_export:start');
    kb.row().text('🏠 القائمة الرئيسية', 'action:main_menu');
    return kb;
  }

  static importSuccessKeyboard(): InlineKeyboard {
    return buildCompletionKeyboard({
      repeatButtonText: '➕ رفع كشف عمال آخر',
      repeatCallbackData: 'action:worker:upload_excel',
      sectionButtonText: '📋 استعراض سجل العاملين المحدث',
      sectionCallbackData: 'action:worker:directory',
      mainMenuCallbackData: 'action:main_menu',
    });
  }

  static exportSuccessKeyboard(): InlineKeyboard {
    return buildCompletionKeyboard({
      repeatButtonText: '➕ استخراج كشف آخر',
      repeatCallbackData: 'action:worker_export:start',
      sectionButtonText: '🔙 العودة للموارد البشرية',
      sectionCallbackData: 'menu:domain:hr',
      mainMenuCallbackData: 'action:main_menu',
    });
  }

  static errorRetryKeyboard(retryAction: string, backAction: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔄 إعادة المحاولة', retryAction)
      .row()
      .text('◀️ رجوع', backAction)
      .text('🏠 القائمة الرئيسية', 'action:main_menu');
  }
}
