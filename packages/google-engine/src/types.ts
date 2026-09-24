export interface GoogleAuthConfig {
  serviceAccountEmail?: string | undefined;
  privateKey?: string | undefined;
  oauthClientId?: string | undefined;
  oauthClientSecret?: string | undefined;
  oauthRefreshToken?: string | undefined;
  jsonKeyPath?: string | undefined;
  tokensJsonPath?: string | undefined;
  driveFolderId?: string | undefined;
  sheetsSpreadsheetId?: string | undefined;
  skipAutoDiscovery?: boolean | undefined;
}

export interface DriveUploadOptions {
  fileName: string;
  mimeType?: string | undefined;
  folderId?: string | undefined;
  buffer?: Buffer | undefined;
  filePath?: string | undefined;
  maxRetries?: number | undefined;
  initialDelayMs?: number | undefined;
  simulateFailureCount?: number | undefined;
}

export interface DriveUploadResult {
  success: boolean;
  fileId: string;
  fileName: string;
  webViewLink?: string | undefined;
  uploadedBytes: number;
  attempts: number;
  provider: 'google_drive' | 'local_fallback';
  error?: string | undefined;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType?: string | undefined;
  webViewLink?: string | undefined;
  parents?: string[] | undefined;
  size?: number | undefined;
}

export interface SheetsAppendOptions {
  spreadsheetId?: string | undefined;
  sheetTitle: string;
  values: unknown[][];
}

export interface SheetsAppendResult {
  success: boolean;
  spreadsheetId: string;
  updatedRange: string;
  updatedRows: number;
  updatedColumns: number;
  updatedCells: number;
  error?: string | undefined;
}
