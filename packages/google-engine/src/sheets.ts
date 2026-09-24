import { googleAuthManager, GoogleAuthManager } from './auth.js';
import type { SheetsAppendOptions, SheetsAppendResult } from './types.js';

export class GoogleSheetsService {
  constructor(private readonly auth: GoogleAuthManager = googleAuthManager) {}

  /**
   * Appends multiple rows to a specified tab in Google Sheets.
   */
  async appendRows(options: SheetsAppendOptions): Promise<SheetsAppendResult> {
    const { sheetTitle, values } = options;
    const spreadsheetId = options.spreadsheetId || this.auth.getSheetsSpreadsheetId();

    if (!values || values.length === 0) {
      return {
        success: false,
        spreadsheetId,
        updatedRange: '',
        updatedRows: 0,
        updatedColumns: 0,
        updatedCells: 0,
        error: 'No values provided to append.',
      };
    }

    const accessToken = await this.auth.getSheetsAccessToken();
    if (!accessToken) {
      return {
        success: false,
        spreadsheetId,
        updatedRange: '',
        updatedRows: 0,
        updatedColumns: 0,
        updatedCells: 0,
        error: 'Google Sheets access token could not be derived.',
      };
    }

    try {
      const range = encodeURIComponent(`${sheetTitle}!A1`);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          spreadsheetId,
          updatedRange: '',
          updatedRows: 0,
          updatedColumns: 0,
          updatedCells: 0,
          error: `Google Sheets API error (${res.status}): ${errText}`,
        };
      }

      const data = (await res.json()) as {
        updates?: {
          updatedRange?: string;
          updatedRows?: number;
          updatedColumns?: number;
          updatedCells?: number;
        };
      };

      return {
        success: true,
        spreadsheetId,
        updatedRange: data.updates?.updatedRange || '',
        updatedRows: data.updates?.updatedRows || values.length,
        updatedColumns: data.updates?.updatedColumns || 0,
        updatedCells: data.updates?.updatedCells || 0,
      };
    } catch (err: any) {
      return {
        success: false,
        spreadsheetId,
        updatedRange: '',
        updatedRows: 0,
        updatedColumns: 0,
        updatedCells: 0,
        error: `Network error appending to Google Sheets: ${err.message}`,
      };
    }
  }

  /**
   * Appends a single row to a specified tab in Google Sheets.
   */
  async appendRow(
    sheetTitle: string,
    row: unknown[],
    spreadsheetId?: string
  ): Promise<SheetsAppendResult> {
    return this.appendRows({
      spreadsheetId,
      sheetTitle,
      values: [row],
    });
  }
}

export const googleSheetsService = new GoogleSheetsService();
