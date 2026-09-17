import { InlineKeyboard } from 'grammy';
import { getGovernoratesList } from './helper.js';
import type { GovernoratePickerOptions } from './types.js';

export const DEFAULT_GOV_PAGE_SIZE = 9;

/**
 * Builds an inline keyboard for selecting an Egyptian governorate with 3x3 layout,
 * in-place pagination, and standard RTL navigation controls.
 */
export function buildGovernoratePickerKeyboard(options: GovernoratePickerOptions = {}): InlineKeyboard {
  const govs = getGovernoratesList();
  const pageSize = options.pageSize ?? DEFAULT_GOV_PAGE_SIZE;
  const totalPages = Math.ceil(govs.length / pageSize) || 1;
  const currentPage = Math.max(1, Math.min(options.page ?? 1, totalPages));

  const startIndex = (currentPage - 1) * pageSize;
  const pageGovs = govs.slice(startIndex, startIndex + pageSize);

  const prefix = options.actionPrefix ?? 'gov_sel:';
  const sep = prefix.endsWith(':') ? '' : ':';
  const pagePrefix = options.pagePrefix ?? 'gov_page:';
  const pageSep = pagePrefix.endsWith(':') ? '' : ':';
  const noopCallback = options.noopCallbackData ?? 'action:site:gov:noop';

  const keyboard = new InlineKeyboard();

  // 1. Governorates 3 per row (3x3 grid)
  for (let i = 0; i < pageGovs.length; i += 3) {
    const chunk = pageGovs.slice(i, i + 3);
    for (const g of chunk) {
      const val = options.valueType === 'code' ? g.code : g.nameAr;
      keyboard.text(g.nameAr, `${prefix}${sep}${val}`);
    }
    keyboard.row();
  }

  // 2. RTL Navigation Row: [ ◀️ التالي ], [ 📄 صفحة X من Y ], [ السابق ▶️ ]
  if (currentPage < totalPages) {
    keyboard.text('◀️ التالي', `${pagePrefix}${pageSep}${currentPage + 1}`);
  }
  keyboard.text(`📄 صفحة ${currentPage} من ${totalPages}`, noopCallback);
  if (currentPage > 1) {
    keyboard.text('السابق ▶️', `${pagePrefix}${pageSep}${currentPage - 1}`);
  }
  keyboard.row();

  // 3. Control Row: [ ◀️ السابق ] alongside [ ❌ إلغاء ]
  if (options.backCallbackData && options.cancelCallbackData) {
    keyboard
      .text('◀️ السابق', options.backCallbackData)
      .text(options.cancelText ?? '❌ إلغاء', options.cancelCallbackData);
  } else if (options.backCallbackData) {
    keyboard.text('◀️ السابق', options.backCallbackData);
  } else if (options.cancelCallbackData) {
    keyboard.text(options.cancelText ?? '❌ إلغاء', options.cancelCallbackData);
  }

  return keyboard;
}
