import { InlineKeyboard } from 'grammy';
import {
  buildWorkerPickerKeyboard,
  type WorkerItem,
  type PaginationState,
} from '@alsaada/core-components';

export interface Profile360ActionsOptions {
  workerId: string;
  whatsAppUrl?: string | undefined;
  hasPhone?: boolean | undefined;
  hasMissingData?: boolean | undefined;
  missingDataWhatsAppUrl?: string | undefined;
  canRevealId?: boolean | undefined;
  isIdRevealed?: boolean | undefined;
  idNumber?: string | undefined;
  phone?: string | undefined;
}

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

  static profile360ActionsKeyboard(
    workerIdOrOptions: string | Profile360ActionsOptions,
    legacyWhatsAppUrl?: string,
    legacyHasPhone: boolean = true,
    legacyMissingDataWhatsAppUrl?: string
  ): InlineKeyboard {
    const kb = new InlineKeyboard();

    let opts: Profile360ActionsOptions;
    if (typeof workerIdOrOptions === 'object') {
      opts = workerIdOrOptions;
    } else {
      opts = {
        workerId: workerIdOrOptions,
        whatsAppUrl: legacyWhatsAppUrl,
        hasPhone: legacyHasPhone,
        hasMissingData: Boolean(legacyMissingDataWhatsAppUrl),
        missingDataWhatsAppUrl: legacyMissingDataWhatsAppUrl,
      };
    }

    // 1. Direct WhatsApp Missing Data (1-tap direct chat with pre-encoded message - no intermediate screen)
    if (opts.missingDataWhatsAppUrl) {
      kb.url('📲 طلب استكمال النواقص عبر واتساب', opts.missingDataWhatsAppUrl).row();
    } else if (opts.hasMissingData) {
      kb.text('📲 طلب استكمال النواقص عبر واتساب', `action:worker:mwa:${opts.workerId}`).row();
    }

    // 2. Direct WhatsApp messaging (general chat)
    if (opts.whatsAppUrl) {
      kb.url('💬 مراسلة العامل عبر واتساب', opts.whatsAppUrl).row();
    }

    // 3. Edit worker
    kb.text('✏️ تعديل بيانات العامل', `action:worker_edit:pick:${opts.workerId}`).row();

    // 4. Navigation
    kb.text('◀️ العودة لدليل العاملين', 'action:worker:directory').row();
    kb.text('🏠 القائمة الرئيسية', 'action:main_menu');

    return kb;
  }

  static missingDataDispatchKeyboard(workerId: string, directWhatsAppUrl?: string): InlineKeyboard {
    const kb = new InlineKeyboard();
    if (directWhatsAppUrl) {
      kb.url('💬 فتح شات واتساب مع العامل', directWhatsAppUrl).row();
    }
    kb.text('◀️ العودة لبطاقة العامل', `action:worker:view:${workerId}`).row();
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
