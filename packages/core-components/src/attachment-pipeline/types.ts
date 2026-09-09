export type AttachmentDomain =
  | 'WORKER_ID'
  | 'CUSTODY_RECEIPT'
  | 'CANTEEN_INVOICE'
  | 'MEDICAL_LEAVE'
  | 'FUEL_SLIP'
  | 'EQUIPMENT_LICENSE';

export interface AttachmentSaveInput {
  domain: AttachmentDomain;
  referenceCode: string; // e.g. OP-DRV-001 or CUST-KHA-09
  fileName: string;
  fileBuffer: Buffer;
  mimeType?: string | undefined;
  maxSizeMegabytes?: number | undefined;
}

export interface AttachmentSaveResult {
  success: boolean;
  relativePath: string;
  absolutePath: string;
  fileSizeBytes: number;
  sha256Hash: string;
  error?: string | undefined;
  errorArabic?: string | undefined;
}
