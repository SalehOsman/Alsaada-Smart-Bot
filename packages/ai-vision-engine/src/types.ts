export type ExpectedDocType =
  | 'NATIONAL_ID_FRONT'
  | 'NATIONAL_ID_BACK'
  | 'PASSPORT'
  | 'INVOICE'
  | 'RECEIPT'
  | 'WAYBILL';

export type DetectedDocType =
  | 'EGYPTIAN_NATIONAL_ID_FRONT'
  | 'EGYPTIAN_NATIONAL_ID_BACK'
  | 'PASSPORT'
  | 'INVOICE'
  | 'RECEIPT'
  | 'WAYBILL'
  | 'OTHER';

export interface AiVisionEngineConfig {
  primaryModel?: string | undefined;
  fallbackModels?: string[] | undefined;
  apiKeys?: string[] | undefined;
  temperature?: number | undefined;
  timeoutMs?: number | undefined;
}

export interface AiVisionScanResult {
  isValid: boolean;
  detectedDocType: DetectedDocType;
  isQualityAcceptable: boolean;
  nationalIdNumber?: string | undefined;
  passportNumber?: string | undefined;
  expiryDateStr?: string | undefined;
  fullName?: string | undefined;
  address?: string | undefined;
  birthDate?: Date | undefined;
  age?: number | undefined;
  gender?: 'MALE' | 'FEMALE' | undefined;
  governorateCode?: string | undefined;
  governorateNameAr?: string | undefined;
  userErrorMessage?: string | undefined;
  notes?: string | undefined;
  confidenceScore?: number | undefined;
  rawJson?: Record<string, unknown> | undefined;
  invoiceData?: InvoiceExtractionResult | undefined;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoiceExtractionResult {
  vendorName?: string | undefined;
  invoiceNumber?: string | undefined;
  transactionDate?: string | undefined;
  currency?: string | undefined;
  items?: InvoiceItem[] | undefined;
  taxAmount?: number | undefined;
  grandTotal?: number | undefined;
  confidenceScore?: number | undefined;
}

export interface RawVisionApiResponse {
  detectedDocType?: string | undefined;
  isCoveredOrObscured?: boolean | undefined;
  isBlurryOrUnreadable?: boolean | undefined;
  nationalIdNumber?: string | null | undefined;
  passportNumber?: string | null | undefined;
  expiryDate?: string | null | undefined;
  fullName?: string | null | undefined;
  address?: string | null | undefined;
  birthDate?: string | null | undefined;
  gender?: string | null | undefined;
  nationality?: string | null | undefined;
  notes?: string | undefined;
  confidenceScore?: number | undefined;
  vendorName?: string | null | undefined;
  invoiceNumber?: string | null | undefined;
  transactionDate?: string | null | undefined;
  currency?: string | null | undefined;
  items?: InvoiceItem[] | null | undefined;
  taxAmount?: number | null | undefined;
  grandTotal?: number | null | undefined;
}
