export type ClearingType = 'CIGARETTES_IN_KIND' | 'SUPPLIER_PURCHASE_IN_KIND' | 'CASH_ADVANCE';

export interface CigaretteClearingInput {
  workerId: string;
  workerCode: string;
  workerName: string;
  brandName: string;
  packPrice: number;
  packsCount: number;
  siteCode: string;
  canteenStockAvailable: number;
}

export interface CigaretteClearingResult {
  success: boolean;
  totalAmount: number;
  inKindPacksCount: number;
  cashOutflow: 0; // Strict 0 cash
  canteenStockDeduction: number;
  siteExpenseReduction: number;
  clearingSummaryArabic: string;
  error?: string | undefined;
}

export interface SupplierPurchaseClearingInput {
  workerId: string;
  workerCode: string;
  supplierId: string;
  supplierName: string;
  itemDescription: string;
  purchaseAmount: number;
  siteCode: string;
  vendorPayableAvailable: number;
}

export interface SupplierPurchaseClearingResult {
  success: boolean;
  totalAmount: number;
  cashOutflow: 0; // Strict 0 cash
  vendorPayableOffset: number;
  clearingSummaryArabic: string;
  error?: string | undefined;
}

export interface CashAdvanceClearingInput {
  workerId: string;
  workerCode: string;
  requestedAmount: number;
  sourceOfFunds: 'SITE_CUSTODY' | 'MAIN_TREASURY';
  sourceEntityId: string;
  sourceEntityName: string;
  availableBalance: number;
}

export interface CashAdvanceClearingResult {
  success: boolean;
  approvedAmount: number;
  cashOutflow: number; // Real cash out
  sourceEntityId: string;
  remainingSourceBalance: number;
  clearingSummaryArabic: string;
  error?: string | undefined;
}
