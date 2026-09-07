import { InlineKeyboard } from 'grammy';
import type { WorkerItem, PaginationState, CustomActionButton } from '../types.js';

export interface WorkerKeyboardOptions {
  workers: WorkerItem[];
  pagination: PaginationState;
  selectedWorkerIds?: string[];
  customActionButtons?: CustomActionButton[];
  allowSearch?: boolean;
  cancelCallbackData?: string;
  workerCallbackPrefix?: string;
  pageCallbackPrefix?: string;
}

/**
 * Builds the inline keyboard for worker selection with in-place pagination and controls.
 */
export function buildWorkerPickerKeyboard(options: WorkerKeyboardOptions): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const workerPrefix = options.workerCallbackPrefix ?? 'worker_sel:';
  const pagePrefix = options.pageCallbackPrefix ?? 'worker_page:';
  const selectedSet = new Set(options.selectedWorkerIds ?? []);

  // 1. Worker Buttons (2 per row or 1 per row if name is long)
  for (const worker of options.workers) {
    const isSelected = selectedSet.has(worker.id);
    const checkmark = isSelected ? '✅ ' : '👤 ';
    const displayName = worker.nickname ? `${worker.nickname}` : worker.name;
    const label = `${checkmark}${displayName} (${worker.code})`;
    keyboard.text(label, `${workerPrefix}${worker.id}`).row();
  }

  // 2. Custom action buttons (e.g. Hospitality)
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

  // 4. Utility Row (Search & Cancel)
  if (options.allowSearch) {
    keyboard.text('🔍 بحث بالاسم أو الكود', 'worker_search_prompt');
  }

  keyboard.text('❌ إلغاء', options.cancelCallbackData ?? 'action:cancel').row();

  return keyboard;
}
