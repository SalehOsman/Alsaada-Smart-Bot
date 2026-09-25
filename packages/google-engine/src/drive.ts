import { existsSync, readFileSync } from 'node:fs';
import { googleAuthManager, GoogleAuthManager } from './auth.js';
import type {
  DriveUploadOptions,
  DriveUploadResult,
  DriveFileMetadata,
} from './types.js';

export class GoogleDriveService {
  constructor(private readonly auth: GoogleAuthManager = googleAuthManager) {}

  /**
   * Uploads an in-memory buffer to Google Drive with 3-tier exponential backoff.
   */
  async uploadBuffer(options: DriveUploadOptions): Promise<DriveUploadResult> {
    const {
      fileName,
      mimeType = 'application/octet-stream',
      buffer,
      filePath,
      maxRetries = 3,
      initialDelayMs = 1500,
    } = options;

    let payload: Buffer | null = buffer ?? null;
    if (!payload && filePath && existsSync(filePath)) {
      payload = readFileSync(filePath);
    }

    if (!payload) {
      return {
        success: false,
        fileId: '',
        fileName,
        uploadedBytes: 0,
        attempts: 0,
        provider: 'local_fallback',
        error: 'No buffer or valid filePath provided for upload.',
      };
    }

    const folderId = options.folderId || this.auth.getDriveFolderId();
    const totalBytes = payload.length;

    let attempt = 0;
    let lastError: Error | undefined;
    let simulatedFailures = options.simulateFailureCount ?? 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        if (simulatedFailures > 0) {
          simulatedFailures--;
          throw new Error(`Transient network glitch (attempt ${attempt})`);
        }

        const accessToken = await this.auth.getDriveAccessToken();
        if (!accessToken) {
          return {
            success: false,
            fileId: '',
            fileName,
            uploadedBytes: 0,
            attempts: attempt,
            provider: 'local_fallback',
            error: 'Google Drive access token could not be derived (missing credentials).',
          };
        }

        const metadata: Record<string, unknown> = {
          name: fileName,
          mimeType,
        };

        if (folderId && folderId.trim().length > 5) {
          metadata.parents = [folderId.trim()];
        }

        const boundary = '-------AlsaadaDriveEngine' + Date.now();
        const multipartBody = Buffer.concat([
          Buffer.from(
            `--${boundary}\r\n` +
              `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
              JSON.stringify(metadata) +
              `\r\n--${boundary}\r\n` +
              `Content-Type: ${mimeType}\r\n` +
              `Content-Transfer-Encoding: base64\r\n\r\n`
          ),
          Buffer.from(payload.toString('base64')),
          Buffer.from(`\r\n--${boundary}--`),
        ]);

        const uploadRes = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartBody,
          }
        );

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          throw new Error(`Google Drive API error (${uploadRes.status}): ${errText}`);
        }

        const data = (await uploadRes.json()) as {
          id: string;
          name: string;
          webViewLink?: string;
          size?: string;
        };

        return {
          success: true,
          fileId: data.id,
          fileName: data.name,
          webViewLink: data.webViewLink,
          uploadedBytes: totalBytes,
          attempts: attempt,
          provider: 'google_drive',
        };
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = initialDelayMs * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    return {
      success: false,
      fileId: '',
      fileName,
      uploadedBytes: 0,
      attempts: attempt,
      provider: 'google_drive',
      error: `Upload failed after ${attempt} attempts: ${lastError?.message}`,
    };
  }

  /**
   * Uploads a file from local disk to Google Drive.
   */
  async uploadFile(filePath: string, options: Partial<DriveUploadOptions> = {}): Promise<DriveUploadResult> {
    if (!existsSync(filePath)) {
      return {
        success: false,
        fileId: '',
        fileName: options.fileName || 'unknown',
        uploadedBytes: 0,
        attempts: 0,
        provider: 'local_fallback',
        error: `File not found on disk: ${filePath}`,
      };
    }

    const fileName = options.fileName || filePath.split(/[/\\]/).pop() || 'upload.bin';
    const buffer = readFileSync(filePath);

    return this.uploadBuffer({
      ...options,
      fileName,
      buffer,
    });
  }

  /**
   * Finds or creates a subfolder within a parent folder in Google Drive.
   */
  async ensureFolder(folderName: string, parentFolderId?: string): Promise<string | null> {
    const parent = parentFolderId || this.auth.getDriveFolderId();
    const accessToken = await this.auth.getDriveAccessToken();
    if (!accessToken) return null;

    try {
      // 1. Search if folder already exists
      const q = `name = '${folderName.replace(/'/g, "\\'")}' and '${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as { files?: { id: string }[] };
        if (searchData.files && searchData.files.length > 0 && searchData.files[0]?.id) {
          return searchData.files[0].id;
        }
      }

      // 2. Create folder if not found
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parent],
        }),
      });

      if (!createRes.ok) return null;
      const createData = (await createRes.json()) as { id: string };
      return createData.id || null;
    } catch {
      return null;
    }
  }

  private readonly folderCache: Map<string, string> = new Map();

  /**
   * Clears the in-memory Google Drive folder ID cache.
   */
  clearFolderCache(): void {
    this.folderCache.clear();
  }

  /**
   * Recursively ensures a hierarchical folder path in Google Drive (e.g. 'backups/database/daily').
   * Uses an in-memory cache to minimize Google Drive API query overhead (<50ms for known nodes).
   */
  async ensureDirectoryTree(pathString: string, baseFolderId?: string): Promise<string | null> {
    if (!pathString || !pathString.trim()) {
      return baseFolderId || this.auth.getDriveFolderId();
    }

    const segments = pathString
      .replace(/\\/g, '/')
      .split('/')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let currentParent = baseFolderId || this.auth.getDriveFolderId();

    for (const segment of segments) {
      const cacheKey = `${currentParent}:${segment}`;
      if (this.folderCache.has(cacheKey)) {
        currentParent = this.folderCache.get(cacheKey)!;
        continue;
      }

      const folderId = await this.ensureFolder(segment, currentParent);
      if (!folderId) {
        return null;
      }

      this.folderCache.set(cacheKey, folderId);
      currentParent = folderId;
    }

    return currentParent;
  }

  /**
   * Fetches metadata for an existing file in Google Drive.
   */
  async getFileMetadata(fileId: string): Promise<DriveFileMetadata | null> {
    const accessToken = await this.auth.getDriveAccessToken();
    if (!accessToken) return null;

    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,webViewLink,parents,size`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!res.ok) return null;
      return (await res.json()) as DriveFileMetadata;
    } catch {
      return null;
    }
  }
}

export const googleDriveService = new GoogleDriveService();
