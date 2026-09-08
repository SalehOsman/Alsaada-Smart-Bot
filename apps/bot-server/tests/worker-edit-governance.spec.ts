import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workerEditService } from '../src/services/worker-edit.service.js';
import { workerExpiryAlertService } from '../src/services/worker-expiry-alert.service.js';
import { prisma } from '../src/db.js';

vi.mock('../src/db.js', () => ({
  prisma: {
    worker: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    workerEditRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../src/services/fast-cache.service.js', () => ({
  fastCache: {
    invalidate: vi.fn().mockResolvedValue(undefined),
    rememberSWR: vi.fn().mockImplementation((_k, _t, fetcher) => fetcher()),
  },
}));

describe('Worker Edit Governance & Expiry Alerts Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Super Admin Direct Worker Profile Editing', () => {
    it('should directly update legacyCode for a worker when called by Super Admin', async () => {
      vi.mocked(prisma.worker.findUnique).mockResolvedValue({
        id: 'worker-123',
        code: 'OP-DRV-001',
        name: 'أحمد محمود',
        legacyCode: null,
        aliases: [],
      } as any);
      vi.mocked(prisma.worker.findFirst).mockResolvedValue(null); // no duplicate
      vi.mocked(prisma.worker.update).mockResolvedValue({
        id: 'worker-123',
        code: 'OP-DRV-001',
        name: 'أحمد محمود',
        legacyCode: 'LEGACY-7788',
      } as any);

      const result = await workerEditService.applyDirectSuperAdminEdit(
        'worker-123',
        'legacyCode',
        'LEGACY-7788'
      );

      expect(result.success).toBe(true);
      expect(result.worker.legacyCode).toBe('LEGACY-7788');
      expect(prisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'worker-123' },
          data: expect.objectContaining({ legacyCode: 'LEGACY-7788' }),
        })
      );
    });

    it('should directly update worker name and nickname', async () => {
      vi.mocked(prisma.worker.findUnique).mockResolvedValue({
        id: 'worker-123',
        aliases: ['أحمد القديم'],
      } as any);
      vi.mocked(prisma.worker.update).mockResolvedValue({
        id: 'worker-123',
        name: 'أحمد محمود علي',
        nickname: 'أبو حميد',
      } as any);

      const result = await workerEditService.applyDirectSuperAdminEdit(
        'worker-123',
        'nickname',
        'أبو حميد'
      );

      expect(result.success).toBe(true);
      expect(prisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'worker-123' },
          data: expect.objectContaining({ nickname: 'أبو حميد' }),
        })
      );
    });
  });

  describe('Field Admin / Worker Modification Request Protocol', () => {
    it('should create a pending edit request with EDT-YYMMDD-XXX format', async () => {
      vi.mocked(prisma.workerEditRequest.count).mockResolvedValue(4); // 5th request today
      vi.mocked(prisma.workerEditRequest.create).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'req-uuid',
          ...data,
          createdAt: new Date(),
        }) as any
      );

      const request = await workerEditService.createEditRequest({
        workerId: 'worker-123',
        workerCode: 'OP-DRV-001',
        workerName: 'أحمد محمود',
        requesterTelegramId: 987654321n,
        requesterName: 'محمود المشرف',
        requesterRole: 'FIELD_ADMIN',
        fieldKey: 'legacyCode',
        fieldName: 'كود العامل القديم',
        oldValue: '-',
        newValue: 'OLD-9900',
        reason: 'إضافة الكود الأرشيفي القديم للمطابقة',
      });

      expect(request.status).toBe('PENDING');
      expect(request.requestId).toMatch(/^EDT-\d{6}-005$/);
      expect(request.newValue).toBe('OLD-9900');
    });

    it('should approve edit request and atomically apply change to worker record', async () => {
      const mockPendingReq = {
        id: 'req-uuid-1',
        requestId: 'EDT-260307-001',
        workerId: 'worker-123',
        fieldKey: 'nickname',
        newValue: 'البلدوزر',
        status: 'PENDING',
      };

      vi.mocked(prisma.workerEditRequest.findUnique).mockResolvedValue(mockPendingReq as any);
      vi.mocked(prisma.worker.findUnique).mockResolvedValue({ id: 'worker-123', aliases: [] } as any);
      vi.mocked(prisma.worker.update).mockResolvedValue({ id: 'worker-123', nickname: 'البلدوزر' } as any);
      vi.mocked(prisma.workerEditRequest.update).mockResolvedValue({
        ...mockPendingReq,
        status: 'APPROVED',
        reviewedByAdminId: 111222333n,
        reviewedAt: new Date(),
      } as any);

      const approved = await workerEditService.approveEditRequest('EDT-260307-001', 111222333n);

      expect(approved.status).toBe('APPROVED');
      expect(prisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'worker-123' },
          data: expect.objectContaining({ nickname: 'البلدوزر' }),
        })
      );
    });

    it('should reject edit request without modifying worker record', async () => {
      const mockPendingReq = {
        id: 'req-uuid-2',
        requestId: 'EDT-260307-002',
        workerId: 'worker-123',
        fieldKey: 'phone',
        newValue: '01099999999',
        status: 'PENDING',
      };

      vi.mocked(prisma.workerEditRequest.findUnique).mockResolvedValue(mockPendingReq as any);
      vi.mocked(prisma.workerEditRequest.update).mockResolvedValue({
        ...mockPendingReq,
        status: 'REJECTED',
        reviewedByAdminId: 111222333n,
        reviewedAt: new Date(),
        reviewNotes: 'الرقم غير مسجل باسم العامل',
      } as any);

      const rejected = await workerEditService.rejectEditRequest(
        'EDT-260307-002',
        111222333n,
        'الرقم غير مسجل باسم العامل'
      );

      expect(rejected.status).toBe('REJECTED');
      expect(prisma.worker.update).not.toHaveBeenCalled();
    });
  });

  describe('Worker ID Expiry 30-Day Alert Protocol', () => {
    it('should find active workers whose ID expires within 30 days and dispatch notifications', async () => {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 20); // 20 days remaining

      const expiringWorker = {
        id: 'worker-exp-1',
        code: 'OP-HLP-015',
        name: 'علي حسن إبراهيم',
        nickname: 'عليوة',
        jobTitle: 'مساعد فني',
        phoneEncrypted: '01012345678',
        telegramId: 555666777n,
        idCardExpiryDate: expiryDate,
        idCardExpiryAlertSentAt: null,
        site: { name: 'محجر العين السخنة' },
      };

      vi.mocked(prisma.worker.findMany).mockResolvedValue([expiringWorker as any]);

      const mockBotApi = {
        sendMessage: vi.fn().mockResolvedValue(true),
      };

      const res = await workerExpiryAlertService.checkAndDispatchExpiryAlerts(mockBotApi);

      expect(res.checkedCount).toBe(1);
      expect(res.alertedCount).toBe(1);
      // Verify Telegram alert sent to worker
      expect(mockBotApi.sendMessage).toHaveBeenCalledWith(
        555666777,
        expect.stringContaining('تنبيه رسمي: اقتراب انتهاء سريان بطاقة الرقم القومي'),
        expect.any(Object)
      );
      // Verify database updated with alert timestamp
      expect(prisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'worker-exp-1' },
          data: expect.objectContaining({ idCardExpiryAlertSentAt: expect.any(Date) }),
        })
      );
    });
  });

  describe('Telegram 64-Byte Callback Data Compliance & Short Mapping', () => {
    it('should bidirectional map all editable fields without loss', async () => {
      const { FIELD_KEY_SHORT_MAP, FIELD_TO_SHORT_MAP } = await import(
        '../src/handlers/worker-edit.handler.js'
      );

      for (const [fullKey, shortKey] of Object.entries(FIELD_TO_SHORT_MAP)) {
        expect(FIELD_KEY_SHORT_MAP[shortKey]).toBe(fullKey);
      }
    });

    it('should strictly ensure all worker-edit inline keyboard callbacks are <= 64 UTF-8 bytes', async () => {
      const { FIELD_TO_SHORT_MAP } = await import(
        '../src/handlers/worker-edit.handler.js'
      );
      const { EGYPTIAN_GOVERNORATES } = await import('@alsaada/national-id-engine');

      const sampleWorkerUuid = '123e4567-e89b-12d3-a456-426614174000'; // Standard 36-char UUID

      // 1. Check worker edit menu field buttons
      for (const shortKey of Object.values(FIELD_TO_SHORT_MAP)) {
        const callback = `we:f:${sampleWorkerUuid}:${shortKey}`;
        const byteLen = Buffer.byteLength(callback, 'utf8');
        expect(byteLen).toBeLessThanOrEqual(64);
      }

      // 2. Check doc actions
      expect(Buffer.byteLength(`we:add:${sampleWorkerUuid}`, 'utf8')).toBeLessThanOrEqual(64);
      expect(Buffer.byteLength(`we:docs:${sampleWorkerUuid}`, 'utf8')).toBeLessThanOrEqual(64);
      expect(Buffer.byteLength(`we:menu:${sampleWorkerUuid}`, 'utf8')).toBeLessThanOrEqual(64);

      // 3. Check governorate picker callbacks
      for (const govCode of Object.keys(EGYPTIAN_GOVERNORATES)) {
        const callback = `we:gov:${sampleWorkerUuid}:${govCode}`;
        const byteLen = Buffer.byteLength(callback, 'utf8');
        expect(byteLen).toBeLessThanOrEqual(64);
      }
    });
  });
});

