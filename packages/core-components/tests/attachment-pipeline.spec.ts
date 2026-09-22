import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { UniversalAttachmentPipeline } from '../src/attachment-pipeline/pipeline.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Universal Attachment Pipeline — Tests', () => {
  const testRoot = join(tmpdir(), `alsaada_attach_test_pinned`);

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    try {
      if (existsSync(testRoot)) rmSync(testRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('1. saves attachment hierarchically with proper sha256 hash', () => {
    // Arrange
    const buffer = Buffer.from('PDF_SAMPLE_CONTENT_FOR_TESTING');

    // Act
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

    // Assert
    expect(res.success).toBe(true);
    expect(res.fileSizeBytes).toBe(buffer.length);
    expect(res.sha256Hash.length).toBe(64);
    expect(existsSync(res.absolutePath)).toBe(true);
    expect(res.relativePath).toContain('attachments/custody-receipt/CUST-001');
  });

  it('2. rejects files exceeding maximum size limit', () => {
    // Arrange
    const largeBuffer = Buffer.alloc(1024 * 1024 * 3); // 3 MB

    // Act
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

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toBe('FILE_SIZE_EXCEEDED');
    expect(res.errorArabic).toContain('يتجاوز الحد الأقصى');
  });
});
