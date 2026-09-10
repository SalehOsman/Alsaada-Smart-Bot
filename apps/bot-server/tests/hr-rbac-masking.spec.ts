import { describe, it, expect, vi } from 'vitest';
import { renderHrHub, renderHrSubHub } from '@alsaada/workforce';
import { MyContext } from '../src/types/context.js';

vi.mock('../src/services/screen-flow.service.js', () => ({
  screenFlowService: {
    trackActiveScreen: vi.fn().mockResolvedValue(undefined),
    cleanupUnfinishedFlow: vi.fn().mockResolvedValue(undefined),
    cleanupIncomingUserMessage: vi.fn().mockResolvedValue(undefined),
    isStaleCallback: vi.fn().mockResolvedValue({ isStale: false }),
    handleStaleCallback: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../src/db.js', () => ({
  prisma: {
    workerEditRequest: {
      count: vi.fn().mockResolvedValue(0),
    },
    worker: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

describe('HR Domain Hub — Strict Pre-Render RBAC Masking & Guards', () => {
  it('should display Payroll sub-hub and Excel buttons for SUPER_ADMIN', async () => {
    let sentMarkup: any = null;
    const mockCtx = {
      from: { id: 111111 },
      chat: { id: 111111 },
      effectiveRole: 'SUPER_ADMIN',
      isRealSuperAdmin: true,
      callbackQuery: null,
      reply: vi.fn().mockImplementation(async (_text, opts) => {
        sentMarkup = opts?.reply_markup;
        return { message_id: 123 };
      }),
    } as unknown as MyContext;

    // 1. فحص ظهور الأقسام الخمسة بما فيها الرواتب للسوبر أدمن
    await renderHrHub(mockCtx, false);

    expect(mockCtx.reply).toHaveBeenCalled();
    const hubButtons = sentMarkup.inline_keyboard.flat();

    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:advances')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:leaves')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:onboarding')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:payroll')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:admin_affairs')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'action:main_menu')).toBe(true);

    // 2. فحص ظهور زر التصنيف الفرعي لاستيراد وتصدير كشف العمال في قسم شؤون العاملين للسوبر أدمن
    await renderHrSubHub(mockCtx, 'onboarding', false);
    const subButtons = sentMarkup.inline_keyboard.flat();
    expect(subButtons.some((b: any) => b.callback_data === 'action:worker:add_single')).toBe(true);
    expect(subButtons.some((b: any) => b.callback_data === 'action:worker:directory')).toBe(true);
    expect(subButtons.some((b: any) => b.callback_data === 'menu:hr_sub:worker_excel')).toBe(true);

    // 3. فحص أزرار قسم استيراد وتصدير كشف العمال للسوبر أدمن (تصدير، قالب، ورفع)
    await renderHrSubHub(mockCtx, 'worker_excel', false);
    const excelSubButtons = sentMarkup.inline_keyboard.flat();
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker_export:start')).toBe(true);
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker:download_excel')).toBe(true);
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker:upload_excel')).toBe(true);
  });

  it('should STRICTLY MASK (hide) Payroll and Excel buttons for FIELD_ADMIN (Zero UI Leakage)', async () => {
    let sentMarkup: any = null;
    const mockCtx = {
      from: { id: 222222 },
      chat: { id: 222222 },
      effectiveRole: 'FIELD_ADMIN',
      isRealSuperAdmin: false,
      callbackQuery: null,
      reply: vi.fn().mockImplementation(async (_text, opts) => {
        sentMarkup = opts?.reply_markup;
        return { message_id: 123 };
      }),
    } as unknown as MyContext;

    // 1. فحص حجب قسم الرواتب تماماً للمشرف الميداني
    await renderHrHub(mockCtx, false);

    expect(mockCtx.reply).toHaveBeenCalled();
    const hubButtons = sentMarkup.inline_keyboard.flat();

    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:advances')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:leaves')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:onboarding')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:admin_affairs')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:payroll')).toBe(false); // محجوب مسبقاً!

    // 2. فحص ظهور زر التصنيف الفرعي للمشرف
    await renderHrSubHub(mockCtx, 'onboarding', false);
    const subButtons = sentMarkup.inline_keyboard.flat();
    expect(subButtons.some((b: any) => b.callback_data === 'action:worker:add_single')).toBe(true);
    expect(subButtons.some((b: any) => b.callback_data === 'action:worker:directory')).toBe(true);
    expect(subButtons.some((b: any) => b.callback_data === 'menu:hr_sub:worker_excel')).toBe(true);

    // 3. فحص أزرار قسم استيراد وتصدير كشف العمال للمشرف: التصدير متاح، لكن رفع الكشف محجوب!
    await renderHrSubHub(mockCtx, 'worker_excel', false);
    const excelSubButtons = sentMarkup.inline_keyboard.flat();
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker_export:start')).toBe(true);
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker:download_excel')).toBe(true);
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker:upload_excel')).toBe(false); // محجوب!
  });

  it('should STRICTLY MASK Payroll and Excel upload in Ghost Mode when Super Admin simulates FIELD_ADMIN', async () => {
    let sentMarkup: any = null;
    const mockCtx = {
      from: { id: 7594239391 },
      chat: { id: 7594239391 },
      effectiveRole: 'FIELD_ADMIN',
      isRealSuperAdmin: true,
      isImpersonating: true,
      callbackQuery: null,
      reply: vi.fn().mockImplementation(async (_text, opts) => {
        sentMarkup = opts?.reply_markup;
        return { message_id: 123 };
      }),
    } as unknown as MyContext;

    // 1. فحص حجب قسم الرواتب تماماً أثناء محاكاة المشرف الميداني
    await renderHrHub(mockCtx, false);
    expect(mockCtx.reply).toHaveBeenCalled();
    const hubButtons = sentMarkup.inline_keyboard.flat();
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:payroll')).toBe(false); // محجوب بالمحاكاة!

    // 2. فحص حجب رفع الإكسيل أثناء محاكاة المشرف الميداني
    await renderHrSubHub(mockCtx, 'worker_excel', false);
    const excelSubButtons = sentMarkup.inline_keyboard.flat();
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker_export:start')).toBe(true);
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker:upload_excel')).toBe(false); // محجوب بالمحاكاة!
  });
});
