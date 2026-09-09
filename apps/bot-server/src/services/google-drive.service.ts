import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/env.js';

export interface SaveWorkerIdPhotosResult {
  localFrontPath?: string | undefined;
  localBackPath?: string | undefined;
  driveFrontId?: string | undefined;
  driveBackId?: string | undefined;
}

export class GoogleDriveService {
  private baseDir = path.resolve(process.cwd(), 'attachments/workers');

  constructor() {
    // التأكد من وجود مجلد المرفقات المحلي الرئيسي
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } catch (e) {
      console.warn('⚠️ [STORAGE] Could not create attachments directory:', e);
    }
  }

  /**
   * 📁 جلب أو إنشاء المجلد الخاص بالعامل باسم كوده الوظيفي
   * مثال: attachments/workers/OP-DRV-001/
   */
  getWorkerDir(workerCode: string): string {
    const sanitizedCode = workerCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const workerDir = path.join(this.baseDir, sanitizedCode);
    if (!fs.existsSync(workerDir)) {
      fs.mkdirSync(workerDir, { recursive: true });
    }
    return workerDir;
  }

  /**
   * 💾 حفظ صور بطاقة العامل في مجلد العامل الخاص بمسمى كود العامل
   * مثال: attachments/workers/OP-DRV-001/OP-DRV-001_front.jpg
   */
  saveWorkerIdLocally(
    workerCode: string,
    frontBuffer?: Buffer,
    backBuffer?: Buffer
  ): { localFrontPath?: string; localBackPath?: string } {
    const sanitizedCode = workerCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const result: { localFrontPath?: string; localBackPath?: string } = {};

    try {
      const workerDir = this.getWorkerDir(sanitizedCode);

      if (frontBuffer && frontBuffer.length > 0) {
        const frontFilename = `${sanitizedCode}_front.jpg`;
        const frontFullPath = path.join(workerDir, frontFilename);
        fs.writeFileSync(frontFullPath, frontBuffer);
        result.localFrontPath = `attachments/workers/${sanitizedCode}/${frontFilename}`;
        console.log(`✅ [STORAGE] Saved front ID locally in worker folder: ${result.localFrontPath}`);
      }

      if (backBuffer && backBuffer.length > 0) {
        const backFilename = `${sanitizedCode}_back.jpg`;
        const backFullPath = path.join(workerDir, backFilename);
        fs.writeFileSync(backFullPath, backBuffer);
        result.localBackPath = `attachments/workers/${sanitizedCode}/${backFilename}`;
        console.log(`✅ [STORAGE] Saved back ID locally in worker folder: ${result.localBackPath}`);
      }
    } catch (err) {
      console.error('❌ [STORAGE] Error saving worker ID photos locally:', err);
    }

    return result;
  }

  /**
   * 📎 حفظ مستند أو مرفق إضافي في مجلد العامل (صورة أو PDF)
   */
  saveWorkerAttachmentLocally(
    workerCode: string,
    originalFileName: string,
    fileBuffer: Buffer
  ): { localPath: string; fileName: string } {
    const sanitizedCode = workerCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const workerDir = this.getWorkerDir(sanitizedCode);

    const ext = path.extname(originalFileName) || '.jpg';
    const baseName = path.basename(originalFileName, ext).replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
    const safeFileName = `${Date.now()}_${baseName}${ext}`;
    const fullPath = path.join(workerDir, safeFileName);

    fs.writeFileSync(fullPath, fileBuffer);
    const localPath = `attachments/workers/${sanitizedCode}/${safeFileName}`;
    console.log(`✅ [STORAGE] Saved worker attachment: ${localPath}`);

    return { localPath, fileName: safeFileName };
  }

  /**
   * 🔐 الحصول على Google OAuth2 Access Token عبر Service Account JWT
   */
  private async getGoogleAccessToken(): Promise<string | null> {
    const email = config.googleServiceAccountEmail;
    const privateKey = config.googlePrivateKey;

    if (!email || !privateKey || privateKey.length < 20) {
      return null;
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      const header = { alg: 'RS256', typ: 'JWT' };
      const claimSet = {
        iss: email,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      };

      const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
      const base64Claim = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
      const signatureInput = `${base64Header}.${base64Claim}`;

      const sign = crypto.createSign('RSA-SHA256');
      sign.update(signatureInput);
      sign.end();
      const signature = sign.sign(privateKey, 'base64url');

      const jwt = `${signatureInput}.${signature}`;

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`⚠️ [GOOGLE-DRIVE] OAuth token request failed (${res.status}): ${errText}`);
        return null;
      }

      const data = (await res.json()) as any;
      return data.access_token || null;
    } catch (error) {
      console.warn('⚠️ [GOOGLE-DRIVE] Could not sign or fetch Google token:', error);
      return null;
    }
  }

  /**
   * ☁️ رفع ملف منفرد إلى مجلد محدد على Google Drive
   */
  async uploadFileToDrive(
    fileName: string,
    fileBuffer: Buffer,
    mimeType = 'image/jpeg'
  ): Promise<string | null> {
    const accessToken = await this.getGoogleAccessToken();
    if (!accessToken) {
      return null;
    }

    const folderId = config.googleDriveFolderId;
    const metadata: any = {
      name: fileName,
      mimeType,
    };

    if (folderId && folderId.trim().length > 5) {
      metadata.parents = [folderId.trim()];
    }

    try {
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartRequestBody = Buffer.concat([
        Buffer.from(
          delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            `Content-Type: ${mimeType}\r\n` +
            'Content-Transfer-Encoding: base64\r\n\r\n'
        ),
        Buffer.from(fileBuffer.toString('base64')),
        Buffer.from(closeDelimiter),
      ]);

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      if (!res.ok) {
        const err = await res.text();
        console.warn(`⚠️ [GOOGLE-DRIVE] File upload failed (${res.status}): ${err}`);
        return null;
      }

      const fileData = (await res.json()) as any;
      console.log(`✅ [GOOGLE-DRIVE] Uploaded ${fileName} to Drive (File ID: ${fileData.id})`);
      return fileData.id || null;
    } catch (err) {
      console.error('❌ [GOOGLE-DRIVE] Error during Drive upload:', err);
      return null;
    }
  }

  /**
   * 🚀 معالجة حفظ بطاقة العامل محلياً ورفعها إلى Google Drive ذرياً
   */
  async processAndArchiveWorkerId(
    workerCode: string,
    frontBuffer?: Buffer,
    backBuffer?: Buffer
  ): Promise<SaveWorkerIdPhotosResult> {
    // 1. الحفظ المحلي الإلزامي في attachments/worker-ids
    const local = this.saveWorkerIdLocally(workerCode, frontBuffer, backBuffer);

    // 2. الرفع إلى Google Drive إن كانت بيانات الاعتماد متوفرة
    let driveFrontId: string | undefined = undefined;
    let driveBackId: string | undefined = undefined;

    const sanitizedCode = workerCode.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (frontBuffer && frontBuffer.length > 0) {
      const frontId = await this.uploadFileToDrive(`${sanitizedCode}_front.jpg`, frontBuffer);
      if (frontId) driveFrontId = frontId;
    }

    if (backBuffer && backBuffer.length > 0) {
      const backId = await this.uploadFileToDrive(`${sanitizedCode}_back.jpg`, backBuffer);
      if (backId) driveBackId = backId;
    }

    return {
      localFrontPath: local.localFrontPath,
      localBackPath: local.localBackPath,
      driveFrontId,
      driveBackId,
    };
  }

  /**
   * 🚀 معالجة حفظ مستند إضافي للعامل محلياً ورفعه إلى Google Drive ذرياً
   */
  async processAndArchiveWorkerAttachment(
    workerCode: string,
    originalFileName: string,
    fileBuffer: Buffer,
    mimeType = 'application/pdf'
  ): Promise<{ localPath: string; fileName: string; driveFileId?: string | undefined }> {
    const saved = this.saveWorkerAttachmentLocally(workerCode, originalFileName, fileBuffer);
    let driveFileId: string | undefined = undefined;

    const sanitizedCode = workerCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const driveName = `[${sanitizedCode}]_${saved.fileName}`;
    const dId = await this.uploadFileToDrive(driveName, fileBuffer, mimeType);
    if (dId) driveFileId = dId;

    return {
      localPath: saved.localPath,
      fileName: saved.fileName,
      driveFileId,
    };
  }
}

export const googleDriveService = new GoogleDriveService();
