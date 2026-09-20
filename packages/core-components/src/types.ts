import { parseRegionalNumber } from '@alsaada/regional-engine';

declare const __positiveFiniteAmountBrand: unique symbol;
export type PositiveFiniteAmount = number & { readonly [__positiveFiniteAmountBrand]: 'PositiveFiniteAmount' };

declare const __safeFinancialQuantityBrand: unique symbol;
export type SafeFinancialQuantity = number & { readonly [__safeFinancialQuantityBrand]: 'SafeFinancialQuantity' };

/**
 * Single Point of Re-Branding for financial amounts.
 * Guarantees that the value is a positive, finite number (> 0) without NaN or Infinity.
 */
export function toPositiveFiniteAmount(val: unknown): PositiveFiniteAmount {
  let num: number | null = null;
  if (typeof val === 'number') {
    num = (!Number.isFinite(val) || isNaN(val)) ? null : val;
  } else if (typeof val === 'string') {
    num = parseRegionalNumber(val);
  } else if (val !== null && val !== undefined && typeof (val as any).toNumber === 'function') {
    const n = Number((val as any).toNumber());
    num = (!Number.isFinite(n) || isNaN(n)) ? null : n;
  }

  if (num === null || !Number.isFinite(num) || isNaN(num) || num <= 0) {
    throw new Error(`[FINANCIAL_BOUNDARY_VIOLATION] [BOUNDARY_DESERIALIZATION_VIOLATION] Amount must be a positive finite number greater than 0, got: ${String(val)}`);
  }
  return num as PositiveFiniteAmount;
}

/**
 * Single Point of Re-Branding for financial quantities.
 * Guarantees that the value is a positive, finite number (> 0) without NaN or Infinity.
 */
export function toSafeFinancialQuantity(val: unknown): SafeFinancialQuantity {
  let num: number | null = null;
  if (typeof val === 'number') {
    num = (!Number.isFinite(val) || isNaN(val)) ? null : val;
  } else if (typeof val === 'string') {
    num = parseRegionalNumber(val);
  } else if (val !== null && val !== undefined && typeof (val as any).toNumber === 'function') {
    const n = Number((val as any).toNumber());
    num = (!Number.isFinite(n) || isNaN(n)) ? null : n;
  }

  if (num === null || !Number.isFinite(num) || isNaN(num) || num <= 0) {
    throw new Error(`[FINANCIAL_BOUNDARY_VIOLATION] [BOUNDARY_DESERIALIZATION_VIOLATION] Quantity must be a positive finite number greater than 0, got: ${String(val)}`);
  }
  return num as SafeFinancialQuantity;
}

export interface WorkerItem {
  id: string;
  code: string; // Current active structured code (e.g. OP-DRV-0042)
  legacyCode?: string | null | undefined; // Historical & legacy code (e.g. "106")
  aliases?: string[] | undefined; // Historical & legacy codes (e.g. ["101", "OP-HLP-0015"])
  name: string;
  nickname?: string | null | undefined;
  jobTitle?: string | null | undefined;
  siteLocation?: string | null | undefined;
  phone?: string | null | undefined;
  dailyWage?: number | null | undefined;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CustomActionButton {
  text: string;
  callbackData: string;
}

export interface CopyTextButton {
  text: string;
  copy_text: {
    text: string;
  };
}

export type TelegramChatAction =
  | 'typing'
  | 'upload_document'
  | 'upload_photo'
  | 'record_video'
  | 'upload_video'
  | 'record_voice'
  | 'upload_voice'
  | 'choose_sticker'
  | 'find_location'
  | 'record_video_note'
  | 'upload_video_note';

export interface LinkPreviewOptions {
  is_disabled?: boolean;
  url?: string;
  prefer_small_media?: boolean;
  prefer_large_media?: boolean;
  show_above_text?: boolean;
}

export interface ModalAlertOptions {
  text: string;
  show_alert: true;
}
