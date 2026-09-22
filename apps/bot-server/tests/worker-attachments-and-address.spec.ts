import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workerEditService, googleDriveService, setWorkforcePrisma } from '@alsaada/workforce';
import { prisma } from '../src/db.js';
import fs from 'node:fs';
import path from 'node:path';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

vi.mock('../src/db.js', () => ({
  prisma: {
    worker: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    workerDocument: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    workerEditRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../src/services/fast-cache.service.js', () => ({
  fastCache: {
    invalidate: vi.fn().mockResolvedValue(undefined),
    rememberSWR: vi.fn().mockImplementation((_k, _t, fetcher) => fetcher()),
  },
}));

describe('Worker Dedicated Folder Storage & Address Extraction / Editing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.clearAllMocks();
    setWorkforcePrisma(prisma);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Address Profile Editing', () => {
    it('directly updates worker address when invoked by Super Admin', async () => {
      // Arrange
      const workerId = 'worker-456';
      const field = 'address';
      const newAddress = 'الشرقية - الزقازيق - ش وادي النيل';

      vi.mocked(prisma.worker.update).mockResolvedValue({
        id: workerId,
        code: 'OP-DRV-002',
        name: 'إبراهيم علي',
        address: newAddress,
      } as any);

      // Act
      const result = await workerEditService.applyDirectSuperAdminEdit(workerId, field, newAddress);

      // Assert
      expect(result.success).toBe(true);
      expect(prisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: workerId },
          data: expect.objectContaining({
            address: newAddress,
          }),
        })
      );
    });

    it('returns error when database update throws during direct edit', async () => {
      // Arrange
      const workerId = 'worker-999';
      vi.mocked(prisma.worker.update).mockRejectedValue(new Error('Database query failed'));

      // Act
      const result = await workerEditService.applyDirectSuperAdminEdit(workerId, 'address', 'New Address');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update worker');
    });
  });

  describe('Dedicated Worker Directory and Attachment Storage', () => {
    it('generates dedicated folder per workerCode and saves attachments locally', () => {
      // Arrange
      const workerCode = 'OP-DRV-0099';
      const fakeBuffer = Buffer.from('test pdf content');
      const fileName = 'contract.pdf';

      // Act
      const saved = googleDriveService.saveWorkerAttachmentLocally(workerCode, fileName, fakeBuffer);

      // Assert
      expect(saved.localPath).toContain('attachments/workers/OP-DRV-0099/');
      expect(saved.fileName).toContain('contract.pdf');

      const fullPath = path.join(process.cwd(), saved.localPath);
      expect(fs.existsSync(fullPath)).toBe(true);

      // Clean up test file and directory
      fs.unlinkSync(fullPath);
      const dirPath = path.dirname(fullPath);
      if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
        fs.rmdirSync(dirPath);
      }
    });

    it('correctly organizes ID card photos into the worker dedicated folder', () => {
      // Arrange
      const workerCode = 'OP-LAB-0050';
      const frontBuffer = Buffer.from('fake front photo');
      const backBuffer = Buffer.from('fake back photo');

      // Act
      const saved = googleDriveService.saveWorkerIdLocally(workerCode, frontBuffer, backBuffer);

      // Assert
      expect(saved.localFrontPath).toBe('attachments/workers/OP-LAB-0050/OP-LAB-0050_front.jpg');
      expect(saved.localBackPath).toBe('attachments/workers/OP-LAB-0050/OP-LAB-0050_back.jpg');

      const frontFullPath = path.join(process.cwd(), saved.localFrontPath!);
      const backFullPath = path.join(process.cwd(), saved.localBackPath!);

      expect(fs.existsSync(frontFullPath)).toBe(true);
      expect(fs.existsSync(backFullPath)).toBe(true);

      // Clean up test files and directory
      fs.unlinkSync(frontFullPath);
      fs.unlinkSync(backFullPath);
      const dirPath = path.dirname(frontFullPath);
      if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
        fs.rmdirSync(dirPath);
      }
    });

    it('rejects deletion of paths attempting directory traversal outside baseDir', () => {
      // Arrange
      const maliciousPath = '../../etc/passwd';

      // Act
      const deleted = googleDriveService.deleteWorkerAttachmentLocally(maliciousPath);

      // Assert
      expect(deleted).toBe(false);
    });
  });
});