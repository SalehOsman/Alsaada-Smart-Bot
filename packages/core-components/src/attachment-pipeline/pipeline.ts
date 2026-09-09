import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { AttachmentSaveInput, AttachmentSaveResult } from './types.js';

export class UniversalAttachmentPipeline {
  /**
   * 📁 حفظ المستند أو المرفق بصيغة هرمية آمنة وبصمة SHA-256 جنائية
   * المسار: attachments/<domain>/<referenceCode>/<timestamp>_<cleanName>
   */
  static saveAttachment(input: AttachmentSaveInput, storageRoot = process.cwd()): AttachmentSaveResult {
    const { domain, referenceCode, fileName, fileBuffer, maxSizeMegabytes = 15 } = input;

    const maxSizeBytes = maxSizeMegabytes * 1024 * 1024;
    if (fileBuffer.length > maxSizeBytes) {
      return {
        success: false,
        relativePath: '',
        absolutePath: '',
        fileSizeBytes: fileBuffer.length,
        sha256Hash: '',
        error: 'FILE_SIZE_EXCEEDED',
        errorArabic: `⚠️ حجم الملف (${(fileBuffer.length / (1024 * 1024)).toFixed(1)} ميجابايت) يتجاوز الحد الأقصى المسموح به (${maxSizeMegabytes} ميجابايت).`,
      };
    }

    const cleanRef = referenceCode.toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    const cleanDomain = domain.toLowerCase().replace(/_/g, '-');
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();

    const folderRelative = join('attachments', cleanDomain, cleanRef).replace(/\\/g, '/');
    const fileRelative = join(folderRelative, `${timestamp}_${cleanFileName}`).replace(/\\/g, '/');
    const absoluteFolder = resolve(storageRoot, folderRelative);
    const absolutePath = resolve(storageRoot, fileRelative);

    if (!existsSync(absoluteFolder)) {
      mkdirSync(absoluteFolder, { recursive: true });
    }

    writeFileSync(absolutePath, fileBuffer);

    const hash = createHash('sha256').update(fileBuffer).digest('hex');

    return {
      success: true,
      relativePath: fileRelative,
      absolutePath,
      fileSizeBytes: fileBuffer.length,
      sha256Hash: hash,
    };
  }
}
