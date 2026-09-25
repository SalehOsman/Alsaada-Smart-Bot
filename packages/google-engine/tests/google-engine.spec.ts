import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleAuthManager } from '../src/auth.js';
import { GoogleDriveService } from '../src/drive.js';
import { GoogleSheetsService } from '../src/sheets.js';

describe('Enterprise Google Engine Suite (@alsaada/google-engine)', () => {
  describe('1. GoogleAuthManager', () => {
    it('initializes with custom config and resolves IDs', () => {
      const auth = new GoogleAuthManager({
        driveFolderId: 'custom-drive-folder-123',
        sheetsSpreadsheetId: 'custom-sheet-456',
      });

      expect(auth.getDriveFolderId()).toBe('custom-drive-folder-123');
      expect(auth.getSheetsSpreadsheetId()).toBe('custom-sheet-456');
    });

    it('returns null gracefully when OAuth credentials are not provided', async () => {
      const auth = new GoogleAuthManager({
        skipAutoDiscovery: true,
      });

      const token = await auth.getUserAccessToken();
      expect(token).toBeNull();
    });

    it('returns null gracefully when Service Account credentials are not provided', async () => {
      const auth = new GoogleAuthManager({
        skipAutoDiscovery: true,
      });

      const token = await auth.getServiceAccountAccessToken();
      expect(token).toBeNull();
    });
  });

  describe('2. GoogleDriveService', () => {
    it('returns failure when neither buffer nor valid filePath is provided', async () => {
      const drive = new GoogleDriveService();
      const res = await drive.uploadBuffer({
        fileName: 'empty.txt',
      });

      expect(res.success).toBe(false);
      expect(res.provider).toBe('local_fallback');
      expect(res.error).toContain('No buffer or valid filePath');
    });

    it('returns local_fallback when access token cannot be derived', async () => {
      const mockAuth = new GoogleAuthManager({
        skipAutoDiscovery: true,
      });

      const drive = new GoogleDriveService(mockAuth);
      const res = await drive.uploadBuffer({
        fileName: 'test.bin',
        buffer: Buffer.from('test data'),
      });

      expect(res.success).toBe(false);
      expect(res.provider).toBe('local_fallback');
      expect(res.error).toContain('access token could not be derived');
    });

    it('retries with exponential backoff on transient errors and succeeds', async () => {
      const mockAuth = {
        getDriveFolderId: () => 'test-folder-id',
        getDriveAccessToken: async () => 'mock-token-xyz',
      } as any;

      // Mock global fetch to succeed
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'drive_file_12345',
          name: 'test.txt',
          webViewLink: 'https://drive.google.com/file/d/drive_file_12345/view',
        }),
      } as any);

      const drive = new GoogleDriveService(mockAuth);
      const res = await drive.uploadBuffer({
        fileName: 'test.txt',
        buffer: Buffer.from('mock content'),
        simulateFailureCount: 1, // fails attempt 1, succeeds on attempt 2
        initialDelayMs: 5,
        maxRetries: 3,
      });

      expect(res.success).toBe(true);
      expect(res.fileId).toBe('drive_file_12345');
      expect(res.attempts).toBe(2);
      expect(res.provider).toBe('google_drive');

      fetchSpy.mockRestore();
    });

    it('fails gracefully when retries are exhausted', async () => {
      const mockAuth = {
        getDriveFolderId: () => 'test-folder-id',
        getDriveAccessToken: async () => 'mock-token-xyz',
      } as any;

      const drive = new GoogleDriveService(mockAuth);
      const res = await drive.uploadBuffer({
        fileName: 'test.txt',
        buffer: Buffer.from('mock content'),
        simulateFailureCount: 5,
        initialDelayMs: 5,
        maxRetries: 2,
      });

      expect(res.success).toBe(false);
      expect(res.attempts).toBe(2);
      expect(res.error).toContain('Upload failed after 2 attempts');
    });

    it('handles non-existent file path gracefully', async () => {
      const drive = new GoogleDriveService();
      const res = await drive.uploadFile('non-existent-file-path-2026.xyz');

      expect(res.success).toBe(false);
      expect(res.provider).toBe('local_fallback');
      expect(res.error).toContain('File not found on disk');
    });
    it('creates nested directory tree and utilizes cache to prevent redundant calls', async () => {
      const mockAuth = {
        getDriveFolderId: () => 'root-vault-123',
        getDriveAccessToken: async () => 'mock-token',
      } as any;

      const drive = new GoogleDriveService(mockAuth);
      const ensureSpy = vi.spyOn(drive, 'ensureFolder')
        .mockResolvedValueOnce('folder-backups')
        .mockResolvedValueOnce('folder-database')
        .mockResolvedValueOnce('folder-daily');

      // First call resolves tree
      const leafId = await drive.ensureDirectoryTree('backups/database/daily');
      expect(leafId).toBe('folder-daily');
      expect(ensureSpy).toHaveBeenCalledTimes(3);

      // Second call utilizes in-memory cache
      const cachedLeafId = await drive.ensureDirectoryTree('backups/database/daily');
      expect(cachedLeafId).toBe('folder-daily');
      expect(ensureSpy).toHaveBeenCalledTimes(3); // Zero redundant API calls!
    });
  });

  describe('3. GoogleSheetsService', () => {
    it('returns error when appending empty rows', async () => {
      const sheets = new GoogleSheetsService();
      const res = await sheets.appendRows({
        sheetTitle: 'Sheet1',
        values: [],
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('No values provided');
    });

    it('handles missing access token gracefully', async () => {
      const mockAuth = {
        getSheetsSpreadsheetId: () => 'test-sheet-id',
        getSheetsAccessToken: async () => null,
      } as any;

      const sheets = new GoogleSheetsService(mockAuth);
      const res = await sheets.appendRow('Sheet1', ['a', 'b', 'c']);

      expect(res.success).toBe(false);
      expect(res.error).toContain('access token could not be derived');
    });

    it('successfully appends row when API returns 200 OK', async () => {
      const mockAuth = {
        getSheetsSpreadsheetId: () => 'test-sheet-id',
        getSheetsAccessToken: async () => 'mock-token-abc',
      } as any;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          updates: {
            updatedRange: "'الورقة1'!A1:C1",
            updatedRows: 1,
            updatedColumns: 3,
            updatedCells: 3,
          },
        }),
      } as any);

      const sheets = new GoogleSheetsService(mockAuth);
      const res = await sheets.appendRow('الورقة1', ['2026-09-25', 'Active', 'Test']);

      expect(res.success).toBe(true);
      expect(res.updatedRange).toBe("'الورقة1'!A1:C1");
      expect(res.updatedRows).toBe(1);
      expect(res.updatedCells).toBe(3);

      fetchSpy.mockRestore();
    });
  });
});
