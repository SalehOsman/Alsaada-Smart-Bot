import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { UniversalAttachmentPipeline } from '../src/attachment-pipeline/pipeline.js';

describe('Universal Attachment Pipeline — Tests', () => {
  const testRoot = join(tmpdir(), `alsaada_attach_test_${Date.now()}`);

  afterAll(() => {
    try {
      if (existsSync(testRoot)) rmSync(testRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('should save attachment hierarchically with proper sha256 hash', () => {
    const buffer = Buffer.from('PDF_SAMPLE_CONTENT_FOR_TESTING');
    const res = UniversalAttachmentPipeline.saveAttachment(
      {
        domain: 'CUSTODY_RECEIPT',
        referenceCode: 'CUST-001',
        fileName: 'invoice.pdf',
        fileBuffer: buffer,
        maxSizeMegabytes: 5,
      },
      testRoot
    );

    expect(res.success).toBe(true);
    expect(res.fileSizeBytes).toBe(buffer.length);
    expect(res.sha256Hash.length).toBe(64);
    expect(existsSync(res.absolutePath)).toBe(true);
    expect(res.relativePath).toContain('attachments/custody-receipt/CUST-001');
  });

  it('should reject files exceeding maximum size limit', () => {
    const largeBuffer = Buffer.alloc(1024 * 1024 * 3); // 3 MB
    const res = UniversalAttachmentPipeline.saveAttachment(
      {
        domain: 'FUEL_SLIP',
        referenceCode: 'STE-KHA',
        fileName: 'huge.jpg',
        fileBuffer: largeBuffer,
        maxSizeMegabytes: 2, // limit is 2 MB
      },
      testRoot
    );

    expect(res.success).toBe(false);
    expect(res.error).toBe('FILE_SIZE_EXCEEDED');
    expect(res.errorArabic).toContain('يتجاوز الحد الأقصى');
  });
});
