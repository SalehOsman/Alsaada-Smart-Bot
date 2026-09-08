import { InlineKeyboard } from 'grammy';
import type { WorkerItem, PaginationState, CustomActionButton } from '../types.js';

export interface WorkerKeyboardOptions {
  workers: WorkerItem[];
  pagination: PaginationState;
  selectedWorkerIds?: string[];
  customActionButtons?: CustomActionButton[];
  allowSearch?: boolean;
  cancelCallbackData?: string;
  backCallbackData?: string;
  mainMenuCallbackData?: string;
  workerCallbackPrefix?: string;
  pageCallbackPrefix?: string;
  includeLegacyCode?: boolean;
}

/**
 * Resolves the primary display name for a worker, strictly prioritizing nickname (اسم الشهرة).
 * Returns the worker's nickname if present and non-empty, otherwise falls back to full name.
 */
export function getWorkerDisplayName(worker: { name: string; nickname?: string | null }): string {
  if (worker.nickname && worker.nickname.trim().length > 0) {
    return worker.nickname.trim();
  }
  return worker.name.trim();
}

/**
 * Resolves an appropriate descriptive emoji icon based on the worker's job title / profession.
 */
export function getJobTitleIcon(jobTitle?: string | null): string {
  if (!jobTitle) return '👷';
  const t = jobTitle.trim().toLowerCase();

  // Drivers and heavy machinery operators
  if (/سائق|لودر|شاحن|قلاب|تريلا|معدة|حفار|بلدوزر|جرار|سيار|سواقة|نقل/i.test(t)) {
    return '🚜';
  }
  // Technical, mechanical, electrical, hydraulics, maintenance
  if (/فني|ميكانيك|كهربا|هيدروليك|صيان|تبريد|طلمبات|ديزل/i.test(t)) {
    return '🔧';
  }
  // Industrial plant, crusher, screening line operators
  if (/مشغل|كسارة|خط فرز|محطة|تحكم|تشغيل/i.test(t)) {
    return '⚙️';
  }
  // Blacksmiths, welders, lathe
  if (/حداد|لحام|خراط|برادة|صاج/i.test(t)) {
    return '⚒️';
  }
  // Carpenters, builders, masonry, concrete
  if (/نجار|بناء|خرسانة|محار|جبس|سيراميك|مباني/i.test(t)) {
    return '🧱';
  }
  // Engineers, surveyors
  if (/مهندس|مساح|مساحة|جيولوج/i.test(t)) {
    return '📐';
  }
  // Supervisors, safety, security, guards
  if (/مشرف|مراقب|أمن|حراس|سلامة|صحة مهنية/i.test(t)) {
    return '🛡️';
  }
  // Cooks, catering, chefs, kitchen
  if (/طباخ|شيف|إعاشة|مطبخ|أغذية/i.test(t)) {
    return '🍳';
  }
  // Accountants, admins, storekeepers, clerks, HR
  if (/محاسب|إداري|مخزن|أمين|كاتب|شؤون|مدير|مالي/i.test(t)) {
    return '💼';
  }
  // General labor, production, mining, quarry, loaders
  if (/عامل|إنتاج|تعدين|موقع|محجر|حفر|تحميل|تعتيق|مساعد/i.test(t)) {
    return '👷';
  }

  return '👷';
}

/**
 * Formats a worker's button or list label consistently across the bot:
 * `[أيقونة الوظيفة] [اسم الشهرة] ([المسمى الوظيفي])` (e.g. `🚜 صالح رجب (سائق لودر)`)
 * Falls back to code if jobTitle is not available.
 */
export function formatWorkerPickerLabel(
  worker: WorkerItem | { name: string; nickname?: string | null; code: string; legacyCode?: string | null; jobTitle?: string | null },
  isSelected = false,
  includeLegacyCode = false
): string {
  const icon = isSelected ? '✅ ' : `${getJobTitleIcon(worker.jobTitle)} `;
  const displayName = getWorkerDisplayName(worker);
  const descriptor = worker.jobTitle && worker.jobTitle.trim().length > 0 ? worker.jobTitle.trim() : worker.code;
  const legacyTag = includeLegacyCode && worker.legacyCode ? ` [قديم: ${worker.legacyCode}]` : '';
  return `${icon}${displayName} (${descriptor})${legacyTag}`;
}

/**
 * Builds the inline keyboard for worker selection with in-place pagination and controls.
 */
export function buildWorkerPickerKeyboard(options: WorkerKeyboardOptions): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const workerPrefix = options.workerCallbackPrefix ?? 'worker_sel:';
  const pagePrefix = options.pageCallbackPrefix ?? 'worker_page:';
  const selectedSet = new Set(options.selectedWorkerIds ?? []);

  // 1. Worker Buttons (prioritizing nickname via formatWorkerPickerLabel)
  for (const worker of options.workers) {
    const isSelected = selectedSet.has(worker.id);
    const label = formatWorkerPickerLabel(worker, isSelected, options.includeLegacyCode ?? false);
    keyboard.text(label, `${workerPrefix}${worker.id}`).row();
  }

  // 2. Custom action buttons (e.g. Hospitality or Pending Requests)
  if (options.customActionButtons && options.customActionButtons.length > 0) {
    for (const btn of options.customActionButtons) {
      keyboard.text(btn.text, btn.callbackData).row();
    }
  }

  // 3. Pagination Controls (only if totalPages > 1)
  if (options.pagination.totalPages > 1) {
    const { page, totalPages } = options.pagination;
    const hasPrev = page > 1;
    const hasNext = page < totalPages;

    if (hasPrev) {
      keyboard.text('◀️ السابق', `${pagePrefix}${page - 1}`);
    } else {
      keyboard.text('⏹️', 'noop');
    }

    keyboard.text(`📄 ${page}/${totalPages}`, 'noop');

    if (hasNext) {
      keyboard.text('التالي ▶️', `${pagePrefix}${page + 1}`);
    } else {
      keyboard.text('⏹️', 'noop');
    }

    keyboard.row();
  }

  // 4. Utility & Navigation Rows (Search, Back/Cancel, Main Menu)
  if (options.allowSearch) {
    keyboard.text('🔍 بحث بالاسم أو الكود', 'worker_search_prompt').row();
  }

  const navButtons: { text: string; callback: string }[] = [];
  if (options.backCallbackData) {
    navButtons.push({ text: '🔙 العودة', callback: options.backCallbackData });
  }
  if (options.cancelCallbackData) {
    navButtons.push({ text: '❌ إلغاء', callback: options.cancelCallbackData });
  } else if (!options.backCallbackData) {
    navButtons.push({ text: '❌ إلغاء', callback: 'action:cancel' });
  }

  if (navButtons.length > 0) {
    for (const btn of navButtons) {
      keyboard.text(btn.text, btn.callback);
    }
    keyboard.row();
  }

  if (options.mainMenuCallbackData) {
    keyboard.text('🏠 القائمة الرئيسية', options.mainMenuCallbackData).row();
  }

  return keyboard;
}
