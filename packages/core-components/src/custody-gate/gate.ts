import type { CustodyAccount, CustodyCheckParams, CustodyLockResult } from './types.js';

export class UniversalCustodyGate {
  /**
   * 🛡️ فحص كفاية رصيد العهدة وقفل الصرف الذري
   * يمنع الرصيد السالب أو الصرف من عهدة مجمدة أو منتهية
   */
  static verifyCustodyFunds(params: CustodyCheckParams): CustodyLockResult {
    const { custody, requiredAmount, operationType } = params;

    if (custody.status !== 'OPEN') {
      return {
        isAllowed: false,
        custodyId: custody.id,
        requestedAmount: requiredAmount,
        availableBalance: custody.currentBalance,
        projectedBalance: custody.currentBalance,
        error: 'CUSTODY_NOT_OPEN',
        errorArabic: `⚠️ العهدة (${custody.code}) غير نشطة (الحالة: ${custody.status === 'FROZEN' ? 'مجمدة' : 'مسواة'}). لا يمكن الصرف منها.`,
      };
    }

    if (requiredAmount <= 0) {
      return {
        isAllowed: false,
        custodyId: custody.id,
        requestedAmount: requiredAmount,
        availableBalance: custody.currentBalance,
        projectedBalance: custody.currentBalance,
        error: 'INVALID_AMOUNT',
        errorArabic: '⚠️ المبلغ المطلوب صرفه يجب أن يكون أكبر من الصفر.',
      };
    }

    if (custody.currentBalance < requiredAmount) {
      return {
        isAllowed: false,
        custodyId: custody.id,
        requestedAmount: requiredAmount,
        availableBalance: custody.currentBalance,
        projectedBalance: custody.currentBalance,
        error: 'INSUFFICIENT_CUSTODY_BALANCE',
        errorArabic: `⚠️ رصيد العهدة الحالي (${custody.currentBalance} ج.م) لا يكفي لصرف (${requiredAmount} ج.م) نظير (${operationType}). العجز: (${Math.round((requiredAmount - custody.currentBalance) * 100) / 100} ج.م).`,
      };
    }

    const projectedBalance = Math.round((custody.currentBalance - requiredAmount) * 100) / 100;

    return {
      isAllowed: true,
      custodyId: custody.id,
      requestedAmount: requiredAmount,
      availableBalance: custody.currentBalance,
      projectedBalance,
    };
  }
}
