import type { FundSourceSelection } from './types.js';
import { formatCurrency } from '@alsaada/regional-engine';

/**
 * Validates whether the chosen funding source has sufficient balance to cover the disbursement.
 */
export function validateFundSourceBalance(
  amount: number,
  source: FundSourceSelection
): { isValid: boolean; error?: string } {
  if (amount <= 0) {
    return { isValid: false, error: 'المبلغ المطلوب صرفه يجب أن يكون أكبر من صفر.' };
  }

  // Main Treasury has unlimited local overdraft (managed by central bank limits)
  if (source.type === 'MAIN_TREASURY') {
    return { isValid: true };
  }

  // Custody source requires strict balance check
  if (source.type === 'CUSTODY') {
    const available = source.availableBalance ?? 0;
    if (amount > available) {
      const formattedAmount = formatCurrency(amount);
      const formattedAvail = formatCurrency(available);
      return {
        isValid: false,
        error: `رصيد العهدة الحالي (${formattedAvail}) لا يكفي لصرف مبلغ (${formattedAmount}). يرجى طلب تعزيز عهدة أو الصرف من الخزينة الرئيسية.`,
      };
    }
  }

  return { isValid: true };
}
