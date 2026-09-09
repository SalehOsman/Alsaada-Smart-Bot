import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workerEditService } from '../src/services/worker-edit.service.js';
import { googleDriveService } from '../src/services/google-drive.service.js';
import { prisma } from '../src/db.js';
import fs from 'node:fs';
import path from 'node:path';

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
    vi.clearAllMocks();
  });

  describe('Address Profile Editing', () => {
    it('should directly update worker address when invoked by Super Admin', async () => {
      vi.mocked(prisma.worker.update).mockResolvedValue({
        id: 'worker-456',
        code: 'OP-DRV-002',
        name: 'إبراهيم علي',
        address: 'الشرقية - الزقازيق - ش وادي النيل',
      } as any);

      const result = await workerEditService.applyDirectSuperAdminEdit(
        'worker-456',
        'address',
        'الشرقية - الزقازيق - ش وادي النيل'
      );

      expect(result.success).toBe(true);
      expect(prisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'worker-456' },
          data: expect.objectContaining({
            address: 'الشرقية - الزقازيق - ش وادي النيل',
          }),
        })
      );
    });
  });

  describe('Dedicated Worker Directory and Attachment Storage', () => {
    it('should generate dedicated folder per workerCode and save attachments locally', () => {
      const workerCode = 'OP-DRV-0099';
      const fakeBuffer = Buffer.from('test pdf content');
      const fileName = 'contract.pdf';

      const saved = googleDriveService.saveWorkerAttachmentLocally(
        workerCode,
        fileName,
        fakeBuffer
      );

      expect(saved.localPath).toContain('attachments/workers/OP-DRV-0099/');
      expect(saved.fileName).toContain('contract.pdf');

      const fullPath = path.join(process.cwd(), saved.localPath);
      expect(fs.existsSync(fullPath)).toBe(true);

      fs.unlinkSync(fullPath);
      const dirPath = path.dirname(fullPath);
      if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
        fs.rmdirSync(dirPath);
      }
    });

    it('should correctly organize ID card photos into the worker dedicated folder', () => {
      const workerCode = 'OP-LAB-0050';
      const frontBuffer = Buffer.from('fake front photo');
      const backBuffer = Buffer.from('fake back photo');

      const saved = googleDriveService.saveWorkerIdLocally(
        workerCode,
        frontBuffer,
        backBuffer
      );

      expect(saved.localFrontPath).toBe('attachments/workers/OP-LAB-0050/OP-LAB-0050_front.jpg');
      expect(saved.localBackPath).toBe('attachments/workers/OP-LAB-0050/OP-LAB-0050_back.jpg');

      const frontFullPath = path.join(process.cwd(), saved.localFrontPath!);
      const backFullPath = path.join(process.cwd(), saved.localBackPath!);

      expect(fs.existsSync(frontFullPath)).toBe(true);
      expect(fs.existsSync(backFullPath)).toBe(true);

      fs.unlinkSync(frontFullPath);
      fs.unlinkSync(backFullPath);
      const dirPath = path.dirname(frontFullPath);
      if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
        fs.rmdirSync(dirPath);
      }
    });
  });
});