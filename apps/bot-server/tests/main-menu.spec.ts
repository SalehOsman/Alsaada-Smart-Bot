import { describe, it, expect } from 'vitest';
import { buildMainMenuKeyboard } from '../src/keyboards/main-menu.keyboard.js';
import { getRoleTitle, buildWelcomeMessage } from '../src/handlers/start.handler.js';
import { MyContext } from '../src/types/context.js';

describe('Role-Based Main Menu & Ghost Mode Keyboards', () => {
  it('should render 6 domain & settings buttons for SUPER_ADMIN without impersonation escape hatch', () => {
    const mockCtx = {
      effectiveRole: 'SUPER_ADMIN',
      isRealSuperAdmin: true,
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat();

    expect(buttons.length).toBe(6);
    expect(buttons.some(b => b.callback_data === 'menu:domain:hr')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:domain:finance')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:domain:operations')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:domain:logistics')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:domain:governance')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:super_admin_settings')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
  });

  it('should render executive buttons for EXECUTIVE role', () => {
    const mockCtx = {
      effectiveRole: 'EXECUTIVE',
      isRealSuperAdmin: false,
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat();

    expect(buttons.some(b => b.callback_data === 'menu:exec:dashboard')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:exec:liquidity')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
  });

  it('should render field admin buttons for FIELD_ADMIN role', () => {
    const mockCtx = {
      effectiveRole: 'FIELD_ADMIN',
      isRealSuperAdmin: false,
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat();

    expect(buttons.some(b => b.callback_data === 'menu:field:advance')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:field:phosphate')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
  });

  it('should render worker self-service buttons for WORKER role', () => {
    const mockCtx = {
      effectiveRole: 'WORKER',
      isRealSuperAdmin: false,
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat();

    expect(buttons.some(b => b.callback_data === 'menu:worker:statement')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:worker:payslip')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
  });

  it('should render supplier portal buttons for SUPPLIER role', () => {
    const mockCtx = {
      effectiveRole: 'SUPPLIER',
      isRealSuperAdmin: false,
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat();

    expect(buttons.some(b => b.callback_data === 'menu:supplier:invoices')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:supplier:payments')).toBe(true);
  });

  it('should render guest onboarding buttons for GUEST role', () => {
    const mockCtx = {
      effectiveRole: 'GUEST',
      isRealSuperAdmin: false,
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat();

    expect(buttons.some(b => b.callback_data === 'menu:guest:register')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:guest:guide')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
  });

  it('should append sovereign escape button when Super Admin is impersonating another role', () => {
    const mockCtx = {
      effectiveRole: 'WORKER',
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat();

    // Worker buttons should be present
    expect(buttons.some(b => b.callback_data === 'menu:worker:statement')).toBe(true);
    // Escape hatch must be present!
    const escapeBtn = buttons.find(b => b.callback_data === 'action:exit_impersonate');
    expect(escapeBtn).toBeDefined();
    expect(escapeBtn?.text).toContain('إنهاء وضع المحاكاة');
  });

  it('should NOT append escape button if regular worker tries to impersonate', () => {
    const mockCtx = {
      effectiveRole: 'WORKER',
      isRealSuperAdmin: false,
      isImpersonating: true,
    } as unknown as MyContext;

    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat();

    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
  });
});

describe('Start Handler & Welcome Messages', () => {
  it('should return correct role titles', () => {
    expect(getRoleTitle('SUPER_ADMIN')).toContain('سوبر أدمن');
    expect(getRoleTitle('EXECUTIVE')).toContain('إدارة تنفيذية');
    expect(getRoleTitle('FIELD_ADMIN')).toContain('مشرف موقع');
    expect(getRoleTitle('WORKER')).toContain('عامل مسجل');
    expect(getRoleTitle('SUPPLIER')).toContain('مورد');
    expect(getRoleTitle('GUEST')).toContain('زائر');
  });

  it('should prepend ghost mode banner when impersonating', () => {
    const mockCtx = {
      from: { id: 123456, first_name: 'أحمد' },
      effectiveRole: 'WORKER',
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    const msg = buildWelcomeMessage(mockCtx);
    expect(msg).toContain('وضع المحاكاة النشط — GHOST MODE');
    expect(msg).toContain('عامل مسجل');
  });

  it('should NOT prepend ghost mode banner when in normal mode', () => {
    const mockCtx = {
      from: { id: 123456, first_name: 'أحمد' },
      effectiveRole: 'SUPER_ADMIN',
      isRealSuperAdmin: true,
      isImpersonating: false,
    } as unknown as MyContext;

    const msg = buildWelcomeMessage(mockCtx);
    expect(msg).not.toContain('GHOST MODE');
  });
});
