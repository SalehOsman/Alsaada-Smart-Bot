import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  workerEditService,
  workerExpiryAlertService,
  setWorkforcePrisma,
  FIELD_KEY_SHORT_MAP,
  FIELD_TO_SHORT_MAP,
} from '@alsaada/workforce';
import { prisma } from '../src/db.js';
import { EGYPTIAN_GOVERNORATES } from '@alsaada/national-id-engine';

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

  describe('Super Admin Direct Worker Profile Editing', () => {
    it('directly updates legacyCode for a worker when called by Super Admin', async () => {
      // Arrange
      const workerId = 'worker-123';
      const targetField = 'legacyCode';
      const newValue = 'LEGACY-7788';

      vi.mocked(prisma.worker.findUnique).mockResolvedValue({
        id: workerId,
        code: 'OP-DRV-001',
        name: 'أحمد محمود',
        legacyCode: null,
        aliases: [],
      } as any);
      vi.mocked(prisma.worker.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.worker.update).mockResolvedValue({
        id: workerId,
        code: 'OP-DRV-001',
        name: 'أحمد محمود',
        legacyCode: newValue,
      } as any);

      // Act
      const result = await workerEditService.applyDirectSuperAdminEdit(workerId, targetField, newValue);

      // Assert
      expect(result.success).toBe(true);
      expect(result.worker.legacyCode).toBe(newValue);
      expect(prisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: workerId },
          data: expect.objectContaining({ legacyCode: newValue }),
        })
      );
    });

    it('directly updates worker name and nickname', async () => {
      // Arrange
      const workerId = 'worker-123';
      const targetField = 'nickname';
      const newNickname = 'أبو حميد';

      vi.mocked(prisma.worker.findUnique).mockResolvedValue({
        id: workerId,
        aliases: ['أحمد القديم'],
      } as any);
      vi.mocked(prisma.worker.update).mockResolvedValue({
        id: workerId,
        name: 'أحمد محمود علي',
        nickname: newNickname,
      } as any);

      // Act
      const result = await workerEditService.applyDirectSuperAdminEdit(workerId, targetField, newNickname);

      // Assert
      expect(result.success).toBe(true);
      expect(prisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: workerId },
          data: expect.objectContaining({ nickname: newNickname }),
        })
      );
    });
  });

  describe('Field Admin / Worker Modification Request Protocol', () => {
    it('creates a pending edit request with EDT-YYMMDD-XXX format', async () => {
      // Arrange
      vi.mocked(prisma.workerEditRequest.count).mockResolvedValue(4);
      vi.mocked(prisma.workerEditRequest.create).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'req-uuid',
          ...data,
          createdAt: PINNED_BASE_TIME,
        }) as any
      );

      // Act
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

      // Assert
      expect(request.status).toBe('PENDING');
      expect(request.requestId).toMatch(/^EDT-\d{6}-005$/);
      expect(request.newValue).toBe('OLD-9900');
    });

    it('approves edit request and atomically applies change to worker record', async () => {
      // Arrange
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
        reviewedAt: PINNED_BASE_TIME,
      } as any);

      // Act
      const approved = await workerEditService.approveEditRequest('EDT-260307-001', 111222333n);

      // Assert
      expect(approved.status).toBe('APPROVED');
      expect(prisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'worker-123' },
          data: expect.objectContaining({ nickname: 'البلدوزر' }),
        })
      );
    });

    it('rejects edit request without modifying worker record', async () => {
      // Arrange
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
        reviewedAt: PINNED_BASE_TIME,
        reviewNotes: 'الرقم غير مسجل باسم العامل',
      } as any);

      // Act
      const rejected = await workerEditService.rejectEditRequest(
        'EDT-260307-002',
        111222333n,
        'الرقم غير مسجل باسم العامل'
      );

      // Assert
      expect(rejected.status).toBe('REJECTED');
      expect(prisma.worker.update).not.toHaveBeenCalled();
    });

    it('throws error when approving non-existent edit request', async () => {
      // Arrange
      vi.mocked(prisma.workerEditRequest.findUnique).mockResolvedValue(null);

      // Act
      const action = workerEditService.approveEditRequest('EDT-NON-EXISTENT', 111222333n);

      // Assert
      await expect(action).rejects.toThrow('طلب التعديل غير موجود أو تمت معالجته مسبقاً');
    });

    it('throws error when rejecting non-existent edit request', async () => {
      // Arrange
      vi.mocked(prisma.workerEditRequest.findUnique).mockResolvedValue(null);

      // Act
      const action = workerEditService.rejectEditRequest('EDT-NON-EXISTENT', 111222333n, 'reason');

      // Assert
      await expect(action).rejects.toThrow('طلب التعديل غير موجود أو تمت معالجته مسبقاً');
    });
  });

  describe('Worker ID Expiry 30-Day Alert Protocol', () => {
    it('finds active workers whose ID expires within 30 days and dispatches notifications', async () => {
      // Arrange
      const expiryDate = new Date(PINNED_BASE_TIME);
      expiryDate.setDate(expiryDate.getDate() + 20);

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

      // Act
      const res = await workerExpiryAlertService.checkAndDispatchExpiryAlerts(mockBotApi);

      // Assert
      expect(res.checkedCount).toBe(1);
      expect(res.alertedCount).toBe(1);
      expect(mockBotApi.sendMessage).toHaveBeenCalledWith(
        555666777,
        expect.stringContaining('تنبيه رسمي: اقتراب انتهاء سريان بطاقة الرقم القومي'),
        expect.any(Object)
      );
      expect(prisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'worker-exp-1' },
          data: expect.objectContaining({ idCardExpiryAlertSentAt: expect.any(Date) }),
        })
      );
    });

    it('returns zero alerted count when no workers have expiring IDs', async () => {
      // Arrange
      vi.mocked(prisma.worker.findMany).mockResolvedValue([]);
      const mockBotApi = {
        sendMessage: vi.fn().mockResolvedValue(true),
      };

      // Act
      const res = await workerExpiryAlertService.checkAndDispatchExpiryAlerts(mockBotApi);

      // Assert
      expect(res.checkedCount).toBe(0);
      expect(res.alertedCount).toBe(0);
      expect(mockBotApi.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Telegram 64-Byte Callback Data Compliance & Short Mapping', () => {
    it('bidirectionally maps all editable fields without data loss', () => {
      // Arrange
      const entries = Object.entries(FIELD_TO_SHORT_MAP);

      // Act & Assert
      for (const [fullKey, shortKey] of entries) {
        // Act
        const mappedFull = FIELD_KEY_SHORT_MAP[shortKey];

        // Assert
        expect(mappedFull).toBe(fullKey);
      }
    });

    it('strictly ensures all worker-edit inline keyboard callbacks are under or equal to 64 UTF-8 bytes', () => {
      // Arrange
      const sampleWorkerUuid = '123e4567-e89b-12d3-a456-426614174000';
      const callbacks: string[] = [];

      // Act
      for (const shortKey of Object.values(FIELD_TO_SHORT_MAP)) {
        callbacks.push(`we:f:${sampleWorkerUuid}:${shortKey}`);
      }
      callbacks.push(`we:add:${sampleWorkerUuid}`);
      callbacks.push(`we:docs:${sampleWorkerUuid}`);
      callbacks.push(`we:menu:${sampleWorkerUuid}`);
      for (const govCode of Object.keys(EGYPTIAN_GOVERNORATES)) {
        callbacks.push(`we:gov:${sampleWorkerUuid}:${govCode}`);
      }

      // Assert
      expect(callbacks.length).toBeGreaterThan(0);
      for (const cb of callbacks) {
        const byteLen = Buffer.byteLength(cb, 'utf8');
        expect(byteLen).toBeLessThanOrEqual(64);
      }
    });
  });
});
