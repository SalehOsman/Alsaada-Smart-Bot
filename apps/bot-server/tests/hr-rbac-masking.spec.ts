import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHrHub, renderHrSubHub } from '@alsaada/workforce';
import { MyContext } from '../src/types/context.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays Payroll sub-hub and Excel buttons for SUPER_ADMIN', async () => {
    // Arrange
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

    // Act 1: Main HR Hub
    await renderHrHub(mockCtx, false);

    // Assert 1: Five domains including payroll visible
    expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    const hubButtons = sentMarkup.inline_keyboard.flat();
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:advances')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:leaves')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:onboarding')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:payroll')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:admin_affairs')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'action:main_menu')).toBe(true);

    // Act 2: Onboarding Sub-hub
    await renderHrSubHub(mockCtx, 'onboarding', false);

    // Assert 2
    expect(mockCtx.reply).toHaveBeenCalledTimes(2);
    const subButtons = sentMarkup.inline_keyboard.flat();
    expect(subButtons.some((b: any) => b.callback_data === 'action:worker:add_single')).toBe(true);
    expect(subButtons.some((b: any) => b.callback_data === 'action:worker:directory')).toBe(true);
    expect(subButtons.some((b: any) => b.callback_data === 'menu:hr_sub:worker_excel')).toBe(true);

    // Act 3: Worker Excel Sub-hub
    await renderHrSubHub(mockCtx, 'worker_excel', false);

    // Assert 3: Export, Template, and Upload all visible for Super Admin
    expect(mockCtx.reply).toHaveBeenCalledTimes(3);
    const excelSubButtons = sentMarkup.inline_keyboard.flat();
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker_export:start')).toBe(true);
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker:download_excel')).toBe(true);
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker:upload_excel')).toBe(true);
  });

  it('strictly masks Payroll and Excel upload buttons for FIELD_ADMIN without UI leakage', async () => {
    // Arrange
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

    // Act 1: Main HR Hub
    await renderHrHub(mockCtx, false);

    // Assert 1: Payroll completely masked
    expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    const hubButtons = sentMarkup.inline_keyboard.flat();
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:advances')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:leaves')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:onboarding')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:admin_affairs')).toBe(true);
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:payroll')).toBe(false);

    // Act 2: Onboarding Sub-hub
    await renderHrSubHub(mockCtx, 'onboarding', false);

    // Assert 2
    expect(mockCtx.reply).toHaveBeenCalledTimes(2);
    const subButtons = sentMarkup.inline_keyboard.flat();
    expect(subButtons.some((b: any) => b.callback_data === 'action:worker:add_single')).toBe(true);
    expect(subButtons.some((b: any) => b.callback_data === 'action:worker:directory')).toBe(true);
    expect(subButtons.some((b: any) => b.callback_data === 'menu:hr_sub:worker_excel')).toBe(true);

    // Act 3: Worker Excel Sub-hub
    await renderHrSubHub(mockCtx, 'worker_excel', false);

    // Assert 3: Export is allowed, but Upload is strictly masked
    expect(mockCtx.reply).toHaveBeenCalledTimes(3);
    const excelSubButtons = sentMarkup.inline_keyboard.flat();
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker_export:start')).toBe(true);
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker:download_excel')).toBe(true);
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker:upload_excel')).toBe(false);
  });

  it('strictly masks Payroll and Excel upload in Ghost Mode when Super Admin simulates FIELD_ADMIN', async () => {
    // Arrange
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

    // Act 1: Main HR Hub
    await renderHrHub(mockCtx, false);

    // Assert 1: Payroll masked in ghost mode
    expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    const hubButtons = sentMarkup.inline_keyboard.flat();
    expect(hubButtons.some((b: any) => b.callback_data === 'menu:hr_sub:payroll')).toBe(false);

    // Act 2: Worker Excel Sub-hub
    await renderHrSubHub(mockCtx, 'worker_excel', false);

    // Assert 2: Excel upload masked in ghost mode
    expect(mockCtx.reply).toHaveBeenCalledTimes(2);
    const excelSubButtons = sentMarkup.inline_keyboard.flat();
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker_export:start')).toBe(true);
    expect(excelSubButtons.some((b: any) => b.callback_data === 'action:worker:upload_excel')).toBe(false);
  });
});
