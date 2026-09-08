import { InlineKeyboard } from 'grammy';
import {
  buildWorkerPickerKeyboard,
  type WorkerItem,
  type PaginationState,
} from '@alsaada/core-components';

export class WorkerDirectoryKeyboards {
  static directoryKeyboard(
    workers: WorkerItem[],
    pagination: PaginationState,
    searchQuery?: string
  ): InlineKeyboard {
    const customActionButtons = [];
    if (searchQuery) {
      customActionButtons.push({
        text: '🔄 إلغاء البحث وعرض كافة العمال',
        callbackData: 'action:worker:dir:clear_search',
      });
    } else {
      customActionButtons.push({
        text: '🔍 بحث بالاسم أو الشهرة أو الكود',
        callbackData: 'action:worker:dir:search_prompt',
      });
    }

    return buildWorkerPickerKeyboard({
      workers,
      pagination,
      customActionButtons,
      workerCallbackPrefix: 'action:worker:view:',
      pageCallbackPrefix: 'action:worker:dir:page:',
      backCallbackData: 'menu:hr_sub:onboarding',
      mainMenuCallbackData: 'action:main_menu',
      includeLegacyCode: false,
    });
  }

  static profile360ActionsKeyboard(workerId: string, whatsAppUrl?: string): InlineKeyboard {
    const kb = new InlineKeyboard();

    if (whatsAppUrl) {
      kb.url('💬 مراسلة العامل عبر واتساب', whatsAppUrl).row();
    }

    kb.text('✏️ تعديل بيانات العامل', `action:worker_edit:pick:${workerId}`).row();
    kb.text('◀️ العودة لدليل العاملين', 'action:worker:directory').row();
    kb.text('🏠 القائمة الرئيسية', 'action:main_menu');

    return kb;
  }

  static searchPromptKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('◀️ إلغاء والعودة للدليل', 'action:worker:directory')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');
  }
}
