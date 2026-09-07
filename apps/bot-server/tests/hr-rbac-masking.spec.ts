import { describe, it, expect, vi } from 'vitest';
import { renderHrHub } from '../src/handlers/hr-hub.handler.js';
import {
  handleDownloadWorkerTemplate,
  handleStartUploadWorkerExcel,
} from '../src/handlers/worker-excel.handler.js';
import { MyContext } from '../src/types/context.js';

vi.mock('../src/services/worker.service.js', () => ({
  workerService: {
    getWorkersSummary: vi.fn().mockResolvedValue({
      totalActive: 42,
      egyptianCount: 38,
      foreignCount: 4,
    }),
    getRecentWorkers: vi.fn().mockResolvedValue([]),
  },
}));

describe('HR Domain Hub — Strict Pre-Render RBAC Masking & Guards', () => {
  it('should display Excel bulk upload and template download buttons for SUPER_ADMIN', async () => {
    let sentMarkup: any = null;
    const mockCtx = {
      effectiveRole: 'SUPER_ADMIN',
      isRealSuperAdmin: true,
      callbackQuery: null,
      reply: vi.fn().mockImplementation(async (_text, opts) => {
        sentMarkup = opts?.reply_markup;
        return { message_id: 123 };
      }),
    } as unknown as MyContext;

    await renderHrHub(mockCtx, false);

    expect(mockCtx.reply).toHaveBeenCalled();
    const buttons = sentMarkup.inline_keyboard.flat();

    // يجب أن تظهر أزرار الإكسيل للسوبر أدمن
    expect(buttons.some((b: any) => b.callback_data === 'action:worker:add_single')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:worker:directory')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:worker:download_excel')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:worker:upload_excel')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:main_menu')).toBe(true);
  });

  it('should STRICTLY MASK (hide) Excel buttons for FIELD_ADMIN (Zero UI Leakage)', async () => {
    let sentMarkup: any = null;
    const mockCtx = {
      effectiveRole: 'FIELD_ADMIN',
      isRealSuperAdmin: false,
      callbackQuery: null,
      reply: vi.fn().mockImplementation(async (_text, opts) => {
        sentMarkup = opts?.reply_markup;
        return { message_id: 123 };
      }),
    } as unknown as MyContext;

    await renderHrHub(mockCtx, false);

    expect(mockCtx.reply).toHaveBeenCalled();
    const buttons = sentMarkup.inline_keyboard.flat();

    // تظهر أزرار التسجيل الفردي والسجل فقط
    expect(buttons.some((b: any) => b.callback_data === 'action:worker:add_single')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:worker:directory')).toBe(true);
    expect(buttons.some((b: any) => b.callback_data === 'action:main_menu')).toBe(true);

    // الحجب المسبق الصارم: يُمنع منعاً باتاً ظهور أزرار الإكسيل
    expect(buttons.some((b: any) => b.callback_data === 'action:worker:download_excel')).toBe(false);
    expect(buttons.some((b: any) => b.callback_data === 'action:worker:upload_excel')).toBe(false);
  });

  it('should block non-super-admin from downloading template if callback invoked directly', async () => {
    const mockCtx = {
      isRealSuperAdmin: false,
      callbackQuery: {},
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      replyWithDocument: vi.fn(),
      reply: vi.fn(),
    } as unknown as MyContext;

    await handleDownloadWorkerTemplate(mockCtx);

    expect(mockCtx.replyWithDocument).not.toHaveBeenCalled();
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('مقتصرة على المدير العام') })
    );
  });

  it('should block non-super-admin from starting Excel upload if callback invoked directly', async () => {
    const mockCtx = {
      isRealSuperAdmin: false,
      from: { id: 99999 },
      callbackQuery: {},
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn(),
      editMessageText: vi.fn(),
    } as unknown as MyContext;

    await handleStartUploadWorkerExcel(mockCtx);

    expect(mockCtx.reply).not.toHaveBeenCalled();
    expect(mockCtx.editMessageText).not.toHaveBeenCalled();
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('مقتصرة على المدير العام') })
    );
  });
});
