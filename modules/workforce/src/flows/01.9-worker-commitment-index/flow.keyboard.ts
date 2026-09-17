import { InlineKeyboard } from 'grammy';
import {
  buildCompletionKeyboard,
  buildWorkerPickerKeyboard,
  getWorkerDisplayName,
  getJobTitleIcon,
  type PaginationState,
} from '@alsaada/core-components';
import type { CommitmentScoreListItem, WorkerCommitmentPickerItem } from './flow.types.js';

export class WorkerCommitmentKeyboards {
  static mainMenuKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔍 استعلام تقييم عامل', 'action:wcs:query')
      .row()
      .text('⚠️ كشف العمال قيد المتابعة (<60)', 'action:wcs:under_review')
      .row()
      .text('🏆 لوحة شرف الأكثر التزاماً', 'action:wcs:honor_roll')
      .row()
      .text('📊 تصدير كشف التقييمات إكسيل RTL', 'action:wcs:export_excel')
      .row()
      .text('◀️ العودة لقسم شؤون العاملين', 'menu:hr_sub:onboarding')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');
  }

  static commitmentListKeyboard(
    items: CommitmentScoreListItem[],
    page: number,
    totalPages: number,
    listType: 'under_review' | 'honor_roll'
  ): InlineKeyboard {
    const kb = new InlineKeyboard();

    for (const item of items) {
      const displayName = item.nickname || item.workerName;
      kb.text(
        `${item.tierBadge} ${displayName} (${item.totalScore} نقطة)`,
        `action:wcs:card:${item.workerId}`
      ).row();
    }

    // Pagination row
    const navRow = [];
    if (page > 1) {
      navRow.push({
        text: '◀️ السابق',
        callback_data: `action:wcs:${listType}:page:${page - 1}`,
      });
    }
    if (page < totalPages) {
      navRow.push({
        text: 'التالي ▶️',
        callback_data: `action:wcs:${listType}:page:${page + 1}`,
      });
    }
    if (navRow.length > 0) {
      kb.row(...navRow);
    }

    kb.row().text('🔙 العودة لقسم مؤشر الالتزام', 'menu:wcs:main');
    return kb;
  }

  static cardActionsKeyboard(workerId: string, isWorkerRole = false): InlineKeyboard {
    if (isWorkerRole) {
      return buildCompletionKeyboard({
        repeatButtonText: '🔄 إعادة استعلام مؤشر التزامي',
        repeatCallbackData: 'action:wcs:card:my',
        sectionButtonText: '🔙 العودة لبوابة العامل',
        sectionCallbackData: 'action:main_menu',
        mainMenuCallbackData: 'action:main_menu',
      });
    }

    const kb = new InlineKeyboard();
    kb.text('📋 العودة لسجل العامل 360°', `action:worker:view:${workerId}`).row();

    const completionKb = buildCompletionKeyboard({
      repeatButtonText: '🔍 استعلام تقييم عامل آخر',
      repeatCallbackData: 'action:wcs:query',
      sectionButtonText: '🔙 العودة لقسم مؤشر الالتزام',
      sectionCallbackData: 'menu:wcs:main',
      mainMenuCallbackData: 'action:main_menu',
    });

    for (const row of completionKb.inline_keyboard) {
      kb.row(...row);
    }

    return kb;
  }

  static searchCancelKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔙 العودة لقائمة العمال', 'action:wcs:query')
      .row()
      .text('🏠 القائمة الرئيسية للمؤشر', 'menu:wcs:main');
  }

  static workerPickerKeyboard(options: {
    workers: WorkerCommitmentPickerItem[];
    pagination: PaginationState;
    searchQuery?: string | undefined;
  }): InlineKeyboard {
    const customActionButtons = [];
    if (options.searchQuery && options.searchQuery.trim().length > 0) {
      customActionButtons.push({
        text: '🔄 إلغاء تصفية البحث وعرض كافة العمال',
        callbackData: 'action:wcs:picker:clear_search',
      });
    } else {
      customActionButtons.push({
        text: '🔍 بحث بالاسم أو الشهرة أو الكود',
        callbackData: 'action:wcs:picker:search_prompt',
      });
    }

    return buildWorkerPickerKeyboard<WorkerCommitmentPickerItem>({
      workers: options.workers,
      pagination: options.pagination,
      customActionButtons,
      workerCallbackPrefix: 'action:wcs:card:',
      pageCallbackPrefix: 'action:wcs:picker:page:',
      backCallbackData: 'menu:wcs:main',
      mainMenuCallbackData: 'action:main_menu',
      formatLabel: (worker) => {
        const jobIcon = getJobTitleIcon(worker.jobTitle);
        const displayName = getWorkerDisplayName(worker);
        const isProbation = worker.tier === 'PROBATION' || !worker.hasEvaluation || worker.score === undefined;
        const scoreText = !isProbation && worker.score !== undefined ? `${worker.score} نقطة` : 'تحت الاختبار';
        return `${worker.tierBadge} ${jobIcon} ${displayName} - ${scoreText}`;
      },
    });
  }
}

