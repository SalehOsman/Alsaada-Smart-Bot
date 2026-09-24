import { InlineKeyboard } from 'grammy';
import {
  buildWorkerPickerKeyboard,
  type WorkerItem,
  type PaginationState,
} from '@alsaada/core-components';

import type { WorkerDocumentItem } from './flow.types.js';

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
  hasTelegram?: boolean | undefined;
  documentsCount?: number | undefined;
}

export function directoryKeyboard(
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

export function profile360ActionsKeyboard(
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

  // 1. Missing Data WhatsApp (NEW-13: Safe intermediate screen or direct link if <= 512 bytes)
  const isMissingUrlSafe =
    Boolean(opts.missingDataWhatsAppUrl) &&
    Buffer.byteLength(opts.missingDataWhatsAppUrl || '', 'utf8') <= 512;

  if (isMissingUrlSafe) {
    kb.url('📲 طلب استكمال النواقص عبر واتساب', opts.missingDataWhatsAppUrl!).row();
  } else if (opts.hasMissingData || opts.missingDataWhatsAppUrl) {
    kb.text('📲 طلب استكمال النواقص عبر واتساب', `action:worker:mwa:${opts.workerId}`).row();
  }

  // 2. Direct WhatsApp messaging (general chat - safe <= 512 bytes)
  if (opts.whatsAppUrl && Buffer.byteLength(opts.whatsAppUrl, 'utf8') <= 512) {
    kb.url('💬 مراسلة العامل عبر واتساب', opts.whatsAppUrl).row();
  }

  // 3. Edit worker
  kb.text('✏️ تعديل بيانات العامل', `action:worker_edit:pick:${opts.workerId}`).row();

  // 4. Documents & Attachments
  const docsCount = opts.documentsCount ?? 0;
  kb.text(`📁 مستندات ومرفقات العامل (${docsCount})`, `action:worker:docs:${opts.workerId}`).row();

  // 5. Worker Commitment Index Card (NEW-80)
  kb.text('⭐ مؤشر التزام وموثوقية العامل', `action:wcs:card:${opts.workerId}`).row();

  // 6. Admin Unlink Worker Telegram (if linked)
  if (opts.hasTelegram) {
    kb.text('🔓 إلغاء ربط حساب التليجرام', `act:wrk:unlink:${opts.workerId}`).row();
  }

  // 6. Navigation
  kb.text('◀️ العودة لدليل العاملين', 'action:worker:directory').row();
  kb.text('🏠 القائمة الرئيسية', 'action:main_menu');

  return kb;
}

export function documentsListKeyboard(
  workerId: string,
  docs: WorkerDocumentItem[],
  canUpload = true
): InlineKeyboard {
  const kb = new InlineKeyboard();

  for (const doc of docs) {
    kb.text(`📄 ${doc.title}`, `action:worker:doc_view:${doc.id}`).row();
  }

  if (canUpload) {
    kb.text('➕ إضافة / رفع مستند جديد', `action:worker:doc_add:${workerId}`).row();
  }

  kb.text('◀️ العودة لبطاقة العامل', `action:worker:view:${workerId}`).row();
  kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
  return kb;
}

export function documentViewKeyboard(
  docId: string,
  workerId: string,
  canDelete = false
): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (canDelete) {
    kb.text('🗑️ حذف المستند نهائياً', `action:worker:doc_del:${docId}`).row();
  }
  kb.text('◀️ العودة لمستندات العامل', `action:worker:docs:${workerId}`).row();
  kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
  return kb;
}

export function documentCategoryPickerKeyboard(workerId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🪪 بطاقة الرقم القومي', 'act:wdoc:cat:NATIONAL_ID').row()
    .text('🛂 جواز السفر', 'act:wdoc:cat:PASSPORT').row()
    .text('📄 تصريح العمل', 'act:wdoc:cat:WORK_PERMIT').row()
    .text('📜 عقد عمل', 'act:wdoc:cat:CONTRACT').row()
    .text('🚗 رخصة قيادة', 'act:wdoc:cat:DRIVING_LICENSE').row()
    .text('👮 فيش وتشبيه', 'act:wdoc:cat:CRIMINAL_RECORD').row()
    .text('🏥 شهادة صحية', 'act:wdoc:cat:HEALTH_CERTIFICATE').row()
    .text('🎓 مؤهل دراسي', 'act:wdoc:cat:EDUCATION').row()
    .text('✏️ مستند مخصص (كتابة العنوان)', 'act:wdoc:cat:CUSTOM').row()
    .text('◀️ إلغاء والعودة للمستندات', `action:worker:docs:${workerId}`);
}

export function cancelDocUploadKeyboard(workerId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('◀️ إلغاء والعودة للمستندات', `action:worker:docs:${workerId}`);
}

export function missingDataDispatchKeyboard(workerId: string, directWhatsAppUrl?: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (directWhatsAppUrl && Buffer.byteLength(directWhatsAppUrl, 'utf8') <= 512) {
    kb.url('💬 فتح شات واتساب مع العامل', directWhatsAppUrl).row();
  }
  kb.text('◀️ العودة لبطاقة العامل', `action:worker:view:${workerId}`).row();
  kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
  return kb;
}

export function searchPromptKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('◀️ إلغاء والعودة للدليل', 'action:worker:directory')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}

export const WorkerDirectoryKeyboards = {
  directoryKeyboard,
  profile360ActionsKeyboard,
  documentsListKeyboard,
  documentViewKeyboard,
  documentCategoryPickerKeyboard,
  cancelDocUploadKeyboard,
  missingDataDispatchKeyboard,
  searchPromptKeyboard,
} as const;
