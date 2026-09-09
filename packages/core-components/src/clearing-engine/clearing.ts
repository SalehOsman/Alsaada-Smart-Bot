import type {
  CigaretteClearingInput,
  CigaretteClearingResult,
  SupplierPurchaseClearingInput,
  SupplierPurchaseClearingResult,
  CashAdvanceClearingInput,
  CashAdvanceClearingResult,
} from './types.js';

export class TripleBalanceClearingEngine {
  /**
   * 🚬 1. مقاصة مسحوبات السجائر العينية
   * القاعدة: عيني، خصم من مخزون الكانتين، تخفيض تكلفة الموقع، صفر خروج نقدية كاش.
   */
  static processCigaretteClearing(input: CigaretteClearingInput): CigaretteClearingResult {
    if (input.packsCount <= 0 || input.packPrice <= 0) {
      return {
        success: false,
        totalAmount: 0,
        inKindPacksCount: 0,
        cashOutflow: 0,
        canteenStockDeduction: 0,
        siteExpenseReduction: 0,
        clearingSummaryArabic: 'فشل: عدد العلب أو السعر غير صالح.',
        error: 'INVALID_PACK_COUNT_OR_PRICE',
      };
    }

    if (input.canteenStockAvailable < input.packsCount) {
      return {
        success: false,
        totalAmount: 0,
        inKindPacksCount: 0,
        cashOutflow: 0,
        canteenStockDeduction: 0,
        siteExpenseReduction: 0,
        clearingSummaryArabic: `فشل: رصيد الكانتين المتاح (${input.canteenStockAvailable}) لا يكفي للكمية المطلوبة (${input.packsCount}).`,
        error: 'INSUFFICIENT_CANTEEN_STOCK',
      };
    }

    const totalAmount = Math.round(input.packsCount * input.packPrice * 100) / 100;

    return {
      success: true,
      totalAmount,
      inKindPacksCount: input.packsCount,
      cashOutflow: 0,
      canteenStockDeduction: input.packsCount,
      siteExpenseReduction: totalAmount,
      clearingSummaryArabic: `مقاصة عينية: خصم (${input.packsCount}) علبة ${input.brandName} بمبلغ (${totalAmount} ج.م) من مخزون الكانتين وتخفيض تكلفة الموقع بصفر كاش.`,
    };
  }

  /**
   * 🛍️ 2. مقاصة المشتريات العينية من الموردين
   * القاعدة: عيني، مقاصة تخفيض مستحقات المورد، صفر خروج نقدية كاش.
   */
  static processSupplierPurchaseClearing(input: SupplierPurchaseClearingInput): SupplierPurchaseClearingResult {
    if (input.purchaseAmount <= 0) {
      return {
        success: false,
        totalAmount: 0,
        cashOutflow: 0,
        vendorPayableOffset: 0,
        clearingSummaryArabic: 'فشل: قيمة المشتريات يجب أن تكون أكبر من الصفر.',
        error: 'INVALID_PURCHASE_AMOUNT',
      };
    }

    return {
      success: true,
      totalAmount: input.purchaseAmount,
      cashOutflow: 0,
      vendorPayableOffset: input.purchaseAmount,
      clearingSummaryArabic: `مقاصة مشتريات عينية: تخفيض مطالبات المورد (${input.supplierName}) بمبلغ (${input.purchaseAmount} ج.م) نظير (${input.itemDescription}) بصفر كاش.`,
    };
  }

  /**
   * 💵 3. صرف السلف النقدية
   * القاعدة: إلزامية تحديد مصدر التمويل (عهدة أو خزينة)، فحص الرصيد اللحظي، خروج نقدية حقيقي.
   */
  static processCashAdvanceClearing(input: CashAdvanceClearingInput): CashAdvanceClearingResult {
    if (input.requestedAmount <= 0) {
      return {
        success: false,
        approvedAmount: 0,
        cashOutflow: 0,
        sourceEntityId: input.sourceEntityId,
        remainingSourceBalance: input.availableBalance,
        clearingSummaryArabic: 'فشل: مبلغ السلفة المطلوب يجب أن يكون أكبر من الصفر.',
        error: 'INVALID_ADVANCE_AMOUNT',
      };
    }

    if (input.availableBalance < input.requestedAmount) {
      return {
        success: false,
        approvedAmount: 0,
        cashOutflow: 0,
        sourceEntityId: input.sourceEntityId,
        remainingSourceBalance: input.availableBalance,
        clearingSummaryArabic: `فشل: رصيد ${input.sourceOfFunds === 'SITE_CUSTODY' ? 'العهدة' : 'الخزينة'} المتاح (${input.availableBalance} ج.م) لا يكفي لمبلغ السلفة (${input.requestedAmount} ج.م).`,
        error: 'INSUFFICIENT_FUNDS',
      };
    }

    const remaining = Math.round((input.availableBalance - input.requestedAmount) * 100) / 100;

    return {
      success: true,
      approvedAmount: input.requestedAmount,
      cashOutflow: input.requestedAmount,
      sourceEntityId: input.sourceEntityId,
      remainingSourceBalance: remaining,
      clearingSummaryArabic: `صرف نقدي معتمد: خروج نقدية فعلية بمبلغ (${input.requestedAmount} ج.م) من ${input.sourceEntityName}، والرصيد المتبقي (${remaining} ج.م).`,
    };
  }
}
