import { describe, it, expect, vi } from 'vitest';
import { ScreenFlowService } from '../src/services/screen-flow.service.js';
import {
  renderWorkersDirectory,
  renderWorkerDetailCard,
} from '../src/handlers/hr-hub.handler.js';
import { handleWorkerWizardCallback, WorkerWizardStep } from '../src/handlers/new-worker-wizard.handler.js';
import { MyContext } from '../src/types/context.js';

vi.mock('../src/redis.js', () => ({
  getUserActiveScreen: vi.fn(),
  setUserActiveScreen: vi.fn(),
  clearUserActiveScreen: vi.fn(),
  clearAllPendingUserActions: vi.fn(),
  getPendingWorkerWizard: vi.fn(),
  setPendingWorkerWizard: vi.fn(),
  clearPendingWorkerWizard: vi.fn(),
  clearPendingWorkerExcelUpload: vi.fn(),
  setPendingWorkerDirSearch: vi.fn(),
  getPendingWorkerDirSearch: vi.fn(),
  clearPendingWorkerDirSearch: vi.fn(),
}));

import * as redisModule from '../src/redis.js';

vi.mock('../src/db.js', () => ({
  prisma: {
    worker: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    workerEditRequest: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

import { prisma } from '../src/db.js';

describe('Universal Ephemeral Flow Cleanup & Receipt Preservation (ScreenFlowService)', () => {
  it('should DELETE intermediate unfinished flow messages cleanly from Telegram chat', async () => {
    const service = new ScreenFlowService();
    const deleteMessageSpy = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      from: { id: 123456 },
      api: {
        deleteMessage: deleteMessageSpy,
        editMessageReplyMarkup: vi.fn(),
      },
    } as unknown as MyContext;

    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 555,
      flowType: 'worker_wizard',
      isCompleted: false,
      updatedAt: Date.now(),
    });

    await service.cleanupUnfinishedFlow(mockCtx);

    expect(deleteMessageSpy).toHaveBeenCalledWith(1001, 555);
    expect(redisModule.clearUserActiveScreen).toHaveBeenCalledWith(123456n);
  });

  it('should PRESERVE finished operation receipts, stripping only their interactive reply markup', async () => {
    const service = new ScreenFlowService();
    const deleteMessageSpy = vi.fn();
    const editMarkupSpy = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      from: { id: 123456 },
      api: {
        deleteMessage: deleteMessageSpy,
        editMessageReplyMarkup: editMarkupSpy,
      },
    } as unknown as MyContext;

    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 777,
      flowType: 'worker_created',
      isCompleted: true, // سند منتهي
      updatedAt: Date.now(),
    });

    await service.cleanupUnfinishedFlow(mockCtx);

    // الرسالة تبقى في الشات ولا يتم حذفها
    expect(deleteMessageSpy).not.toHaveBeenCalled();
    // تُجرد أزرارها لمنع إعادة النقر
    expect(editMarkupSpy).toHaveBeenCalledWith(1001, 777, { reply_markup: undefined });
    expect(redisModule.clearUserActiveScreen).toHaveBeenCalledWith(123456n);
  });

  it('should prevent in-place editing when action is clicked from a completed operation receipt', async () => {
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValue({
      chatId: 1001,
      messageId: 888,
      flowType: 'worker_created',
      isCompleted: true,
      updatedAt: Date.now(),
    });

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 888 }, // نقرة من كارت العملية المكتملة
      },
    } as unknown as MyContext;

    const isCompletedClick = await service.isClickOnCompletedScreen(mockCtx);
    expect(isCompletedClick).toBe(true);

    // يجب حظر التعديل الموضعي فوراً لتبقى الرسالة في الشات دائماً
    const inPlace = await service.shouldRenderInPlace(mockCtx, true);
    expect(inPlace).toBe(false);
  });

  it('should allow in-place editing when action is clicked from regular intermediate menu', async () => {
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 555,
      flowType: 'hr_hub',
      isCompleted: false,
      updatedAt: Date.now(),
    });

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 555 },
      },
    } as unknown as MyContext;

    const inPlace = await service.shouldRenderInPlace(mockCtx, true);
    expect(inPlace).toBe(true);
  });

  it('should detect stale callbacks from old messages and trigger alert with keyboard removal', async () => {
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 999,
      flowType: 'hr_hub',
      updatedAt: Date.now(),
    });

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 111 }, // رسالة قديمة مختلفة عن 999
      },
      editMessageReplyMarkup: vi.fn().mockResolvedValue(true),
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
    } as unknown as MyContext;

    const check = await service.isStaleCallback(mockCtx);
    expect(check.isStale).toBe(true);
    expect(check.reason).toBe('message_mismatch');

    await service.handleStaleCallback(mockCtx);
    expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({ reply_markup: undefined });
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('هذه الرسالة منتهية الصلاحية'),
        show_alert: true,
      })
    );
  });
});

describe('Workers Directory 360 & Financial RBAC Masking', () => {
  const dummyWorker = {
    id: 'w-1',
    code: 'OP-DRV-001',
    legacyCode: 'OLD-99',
    name: 'صالح رجب محمد السيد',
    nickname: 'صالح رجب',
    idType: 'NATIONAL_ID',
    nationalIdEncrypted: '29001011234567',
    birthDate: new Date('1990-01-01'),
    hireDate: new Date('2024-01-01'),
    jobTitle: 'سائق لودر',
    site: { name: 'محجر السخنة' },
    department: { name: 'التشغيل والإنتاج' },
    basicSalary: 8500,
    fixedAllowances: 1500,
    dailyWage: 333.33,
    phoneEncrypted: '01012345678',
    emergencyPhoneEncrypted: '01098765432',
    address: 'السويس - عتاقة',
    governorateCode: '04',
    shiftSystem: '20_WORK_10_REST',
    walletType: 'فودافون كاش',
    accountNumberEncrypted: '01012345678',
    telegramId: 987654321n,
    isDeleted: false,
    status: 'ACTIVE',
  };

  it('should display financial data exclusively to SUPER_ADMIN', async () => {
    vi.mocked(prisma.worker.findUnique).mockResolvedValueOnce(dummyWorker as any);

    let sentText = '';
    let sentMarkup: any = null;
    const mockCtx = {
      from: { id: 111111 },
      chat: { id: 111111 },
      effectiveRole: 'SUPER_ADMIN',
      isRealSuperAdmin: true,
      callbackQuery: null,
      reply: vi.fn().mockImplementation(async (text, opts) => {
        sentText = text;
        sentMarkup = opts?.reply_markup;
        return { message_id: 123 };
      }),
    } as unknown as MyContext;

    await renderWorkerDetailCard(mockCtx, 'w-1', 1, false);

    expect(sentText).toContain('البيانات المالية والمستحقات');
    expect(sentText).toContain('8,500');
    expect(sentText).toContain('1,500');
    expect(sentText).toContain('10,000');

    // 6 action buttons verification
    const buttons = sentMarkup.inline_keyboard.flat();
    expect(buttons.some((b: any) => b.text.includes('واتساب'))).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:worker:call:w-1')).toBe(true);
    expect(buttons.some((b: any) => b.text.includes('دعوة بوت'))).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'we:menu:w-1')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:worker:dir:page:1')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:main_menu')).toBe(true);
  });

  it('should STRICTLY MASK (hide) all financial figures from non-super-admin (Zero Exposure)', async () => {
    vi.mocked(prisma.worker.findUnique).mockResolvedValueOnce(dummyWorker as any);

    let sentText = '';
    const mockCtx = {
      from: { id: 222222 },
      chat: { id: 222222 },
      effectiveRole: 'FIELD_ADMIN',
      isRealSuperAdmin: false,
      callbackQuery: null,
      reply: vi.fn().mockImplementation(async (text) => {
        sentText = text;
        return { message_id: 123 };
      }),
    } as unknown as MyContext;

    await renderWorkerDetailCard(mockCtx, 'w-1', 1, false);

    // الحجب المسبق الصارم: لا رواتب ولا بدلات ولا أجر يومي
    expect(sentText).not.toContain('البيانات المالية والمستحقات');
    expect(sentText).not.toContain('الراتب الأساسي');
    expect(sentText).not.toContain('8,500');
    expect(sentText).not.toContain('البدلات الشهرية');
    expect(sentText).not.toContain('الأجر اليومي التقديري');
  });

  it('should display nickname and job icon in workers directory picker', async () => {
    vi.mocked(prisma.worker.findMany).mockResolvedValueOnce([dummyWorker as any]);

    let sentMarkup: any = null;
    const mockCtx = {
      from: { id: 111111 },
      chat: { id: 111111 },
      callbackQuery: null,
      reply: vi.fn().mockImplementation(async (_text, opts) => {
        sentMarkup = opts?.reply_markup;
        return { message_id: 123 };
      }),
    } as unknown as MyContext;

    await renderWorkersDirectory(mockCtx, 1, undefined, false);

    const buttons = sentMarkup.inline_keyboard.flat();
    const workerBtn = buttons.find((b: any) => b.callback_data === 'action:worker:view:w-1');
    expect(workerBtn).toBeDefined();
    // يجب أن يعرض اسم الشهرة والأيقونة والمسمى الوظيفي
    expect(workerBtn.text).toContain('🚜');
    expect(workerBtn.text).toContain('صالح رجب');
    expect(workerBtn.text).toContain('سائق لودر');
  });
});

describe('New Worker Wizard — Mandatory Back ID Enforcement', () => {
  it('should reject and alert when user attempts to skip back ID card', async () => {
    vi.mocked(redisModule.getPendingWorkerWizard).mockResolvedValueOnce({
      step: WorkerWizardStep.PHOTO_BACK,
      messageId: 444,
      data: {
        idType: 'NATIONAL_ID',
        frontFileId: 'front_photo_123',
      },
    } as any);

    const answerAlertSpy = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 444 },
        data: 'action:worker_photo:skip_back',
      },
      answerCallbackQuery: answerAlertSpy,
    } as unknown as MyContext;

    await handleWorkerWizardCallback(mockCtx);

    expect(answerAlertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('إرفاق ظهر البطاقة إلزامي'),
        show_alert: true,
      })
    );
  });
});
