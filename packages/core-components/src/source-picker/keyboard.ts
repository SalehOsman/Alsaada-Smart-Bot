import { InlineKeyboard } from 'grammy';
import type { CustodyOption } from './types.js';
import { formatCurrency } from '@alsaada/regional-engine';

export interface SourceKeyboardOptions {
  custodies: CustodyOption[];
  includeMainTreasury?: boolean;
  custodyCallbackPrefix?: string;
  mainTreasuryCallbackData?: string;
  backCallbackData?: string;
  cancelCallbackData?: string;
}

/**
 * Builds the inline keyboard for selecting the funding source in cash disbursements.
 */
export function buildSourceOfFundsKeyboard(options: SourceKeyboardOptions): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const custodyPrefix = options.custodyCallbackPrefix ?? 'src_custody:';

  // 1. Custody buttons (1 per row with live balance)
  for (const c of options.custodies) {
    const balanceStr = formatCurrency(c.balance, { decimals: 0 });
    const locationStr = c.location ? ` - ${c.location}` : '';
    const label = `💼 عهدة: ${c.name} (${balanceStr})${locationStr}`;
    keyboard.text(label, `${custodyPrefix}${c.id}`).row();
  }

  // 2. Main Corporate Treasury / Bank Account
  if (options.includeMainTreasury !== false) {
    keyboard.text('🏦 الخزينة المركزية / الحساب البنكي', options.mainTreasuryCallbackData ?? 'src_main_treasury').row();
  }

  // 3. Navigation row: Back & Cancel
  if (options.backCallbackData) {
    keyboard.text('◀️ السابق', options.backCallbackData);
  }
  keyboard.text('❌ إلغاء', options.cancelCallbackData ?? 'action:cancel');

  return keyboard;
}
