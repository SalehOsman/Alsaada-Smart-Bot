import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildMainMenuKeyboard } from '../src/keyboards/main-menu.keyboard.js';
import { buildPersistentReplyKeyboard } from '../src/keyboards/reply-bar.keyboard.js';
import { getCommandsForRole } from '../src/services/command-scope.service.js';
import { getRoleTitle, buildWelcomeMessage } from '../src/handlers/start.handler.js';
import { MyContext } from '../src/types/context.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Role-Based Main Menu & Ghost Mode Keyboards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 5 macro domain buttons for SUPER_ADMIN without system settings or impersonation escape hatch', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'SUPER_ADMIN',
      isRealSuperAdmin: true,
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat() as Array<{ text: string; callback_data?: string }>;

    // Assert
    expect(buttons.length).toBe(5);
    expect(buttons.some(b => b.callback_data === 'menu:domain:hr')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:domain:finance')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:domain:operations')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:domain:logistics')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:domain:governance')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:super_admin_settings')).toBe(false);
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
  });

  it('renders delegated operational buttons for WORKER_SUPERVISOR role', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'WORKER_SUPERVISOR',
      isRealSuperAdmin: false,
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat() as Array<{ text: string; callback_data?: string }>;

    // Assert
    expect(buttons.some(b => b.callback_data === 'flow:fuel_level')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'flow:canteen_dispense')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders field admin 5 macro domain buttons for FIELD_ADMIN role', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'FIELD_ADMIN',
      isRealSuperAdmin: false,
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat() as Array<{ text: string; callback_data?: string }>;

    // Assert
    expect(buttons.length).toBe(5);
    expect(buttons.some(b => b.callback_data === 'menu:domain:hr')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:domain:finance')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:domain:operations')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:domain:logistics')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:domain:governance')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:field_admin_settings')).toBe(false);
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
  });

  it('renders dual identity return button for WORKER role when isDualWorkerMode is true', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'WORKER',
      isRealSuperAdmin: false,
      isImpersonating: false,
      isDualWorkerMode: true,
    } as unknown as MyContext;

    // Act
    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat() as Array<{ text: string; callback_data?: string }>;

    // Assert
    expect(buttons.some(b => b.callback_data === 'action:switch_identity:field_admin')).toBe(true);
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders worker self-service buttons for WORKER role', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'WORKER',
      isRealSuperAdmin: false,
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat() as Array<{ text: string; callback_data?: string }>;

    // Assert
    expect(buttons.some(b => b.callback_data === 'menu:worker:statement')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:worker:payslip')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
  });

  it('renders supplier portal buttons for SUPPLIER role', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'SUPPLIER',
      isRealSuperAdmin: false,
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat() as Array<{ text: string; callback_data?: string }>;

    // Assert
    expect(buttons.some(b => b.callback_data === 'menu:supplier:invoices')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:supplier:payments')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
  });

  it('renders guest onboarding buttons for GUEST role', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'GUEST',
      isRealSuperAdmin: false,
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat() as Array<{ text: string; callback_data?: string }>;

    // Assert
    expect(buttons.some(b => b.callback_data === 'menu:guest:register')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'menu:guest:guide')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
  });

  it('maintains pure role buttons and does not append inline escape button when Super Admin is impersonating another role', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'WORKER',
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    // Act
    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat() as Array<{ text: string; callback_data?: string }>;

    // Assert
    expect(buttons.some(b => b.callback_data === 'menu:worker:statement')).toBe(true);
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
  });

  it('does not append escape button if regular worker tries to impersonate', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'WORKER',
      isRealSuperAdmin: false,
      isImpersonating: true,
    } as unknown as MyContext;

    // Act
    const keyboard = buildMainMenuKeyboard(mockCtx);
    const buttons = keyboard.inline_keyboard.flat() as Array<{ text: string; callback_data?: string }>;

    // Assert
    expect(buttons.some(b => b.callback_data === 'action:exit_impersonate')).toBe(false);
    expect(buttons.length).toBeGreaterThan(0);
  });
});

describe('Start Handler & Welcome Messages', () => {
  it('returns correct role titles for canonical roles', () => {
    // Arrange, Act & Assert
    expect(getRoleTitle('SUPER_ADMIN')).toContain('سوبر أدمن');
    expect(getRoleTitle('GENERAL_ADMIN')).toContain('جينرال أدمن');
    expect(getRoleTitle('FIELD_ADMIN')).toContain('مشرف موقع');
    expect(getRoleTitle('WORKER_SUPERVISOR')).toContain('العامل المشرف');
    expect(getRoleTitle('WORKER')).toContain('عامل مسجل');
    expect(getRoleTitle('SUPPLIER')).toContain('مورد');
    expect(getRoleTitle('GUEST')).toContain('زائر');
    expect(getRoleTitle('SUPER_ADMIN')).not.toContain('زائر');
  });

  it('prepends ghost mode banner when impersonating', () => {
    // Arrange
    const mockCtx = {
      from: { id: 123456, first_name: 'أحمد' },
      effectiveRole: 'WORKER',
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    // Act
    const msg = buildWelcomeMessage(mockCtx);

    // Assert
    expect(msg).toContain('وضع المحاكاة النشط — GHOST MODE');
    expect(msg).toContain('عامل مسجل');
  });

  it('greets simulated entity by their actual name and code when impersonating', () => {
    // Arrange
    const mockCtx = {
      from: { id: 123456, first_name: 'صالح' },
      effectiveRole: 'WORKER',
      isRealSuperAdmin: true,
      isImpersonating: true,
      impersonatedEntity: {
        type: 'WORKER',
        id: 'w-101',
        name: 'محمود إبراهيم',
        code: 'W-101',
      },
    } as unknown as MyContext;

    // Act
    const msg = buildWelcomeMessage(mockCtx);

    // Assert
    expect(msg).toContain('وضع المحاكاة النشط — GHOST MODE');
    expect(msg).toContain('محمود إبراهيم (W-101)');
    expect(msg).not.toContain('مرحباً بك يا *صالح*');
  });

  it('does not prepend ghost mode banner when in normal mode', () => {
    // Arrange
    const mockCtx = {
      from: { id: 123456, first_name: 'أحمد' },
      effectiveRole: 'SUPER_ADMIN',
      isRealSuperAdmin: true,
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const msg = buildWelcomeMessage(mockCtx);

    // Assert
    expect(msg).not.toContain('GHOST MODE');
    expect(msg).toContain('سوبر أدمن');
  });
});

describe('Persistent Bottom Reply Keyboard', () => {
  it('builds persistent reply keyboard for SUPER_ADMIN with home and system settings only', () => {
    // Arrange
    const mockCtx = { effectiveRole: 'SUPER_ADMIN' } as MyContext;

    // Act
    const kb = buildPersistentReplyKeyboard(mockCtx);
    const buttons = kb.keyboard.flat() as Array<{ text: string }>;

    // Assert
    expect(buttons.length).toBe(2);
    expect(buttons.some(b => b.text === '🏠 القائمة الرئيسية')).toBe(true);
    expect(buttons.some(b => b.text === '⚙️ إعدادات النظام')).toBe(true);
    expect(buttons.some(b => b.text === '👤 ملفي الشخصي')).toBe(false);
    expect(buttons.some(b => b.text === '⚡ فحص الكفاءة')).toBe(false);
  });

  it('builds persistent reply keyboard for FIELD_ADMIN with worker switch button', () => {
    // Arrange
    const mockCtx = { effectiveRole: 'FIELD_ADMIN' } as MyContext;

    // Act
    const kb = buildPersistentReplyKeyboard(mockCtx);
    const buttons = kb.keyboard.flat() as Array<{ text: string }>;

    // Assert
    expect(buttons.some(b => b.text === '🏠 القائمة الرئيسية')).toBe(true);
    expect(buttons.some(b => b.text === '👷 التبديل لحسابي كعامل')).toBe(true);
    expect(buttons.some(b => b.text === '👤 ملفي الشخصي')).toBe(true);
  });

  it('builds persistent reply keyboard for WORKER_SUPERVISOR with fuel level button', () => {
    // Arrange
    const mockCtx = { effectiveRole: 'WORKER_SUPERVISOR' } as MyContext;

    // Act
    const kb = buildPersistentReplyKeyboard(mockCtx);
    const buttons = kb.keyboard.flat() as Array<{ text: string }>;

    // Assert
    expect(buttons.some(b => b.text === '🏠 القائمة الرئيسية')).toBe(true);
    expect(buttons.some(b => b.text === '🚜 تسجيل منسوب')).toBe(true);
    expect(buttons.some(b => b.text === '👤 ملفي الشخصي')).toBe(true);
  });

  it('builds persistent reply keyboard for WORKER in dual mode with supervisor return button', () => {
    // Arrange
    const mockCtx = { effectiveRole: 'WORKER', isDualWorkerMode: true } as MyContext;

    // Act
    const kb = buildPersistentReplyKeyboard(mockCtx);
    const buttons = kb.keyboard.flat() as Array<{ text: string }>;

    // Assert
    expect(buttons.some(b => b.text === '🏠 القائمة الرئيسية')).toBe(true);
    expect(buttons.some(b => b.text === '🛡️ العودة لبوابة الإشراف')).toBe(true);
  });

  it('builds persistent reply keyboard for regular WORKER with statement and payslip', () => {
    // Arrange
    const mockCtx = { effectiveRole: 'WORKER', isDualWorkerMode: false } as MyContext;

    // Act
    const kb = buildPersistentReplyKeyboard(mockCtx);
    const buttons = kb.keyboard.flat() as Array<{ text: string }>;

    // Assert
    expect(buttons.some(b => b.text === '🏠 القائمة الرئيسية')).toBe(true);
    expect(buttons.some(b => b.text === '📊 كشف حسابي')).toBe(true);
    expect(buttons.some(b => b.text === '🧾 قسيمة راتبي')).toBe(true);
  });

  it('does not include /cancel button on persistent reply keyboard', () => {
    // Arrange
    const mockCtx = { effectiveRole: 'SUPER_ADMIN' } as MyContext;

    // Act
    const kb = buildPersistentReplyKeyboard(mockCtx);
    const buttons = kb.keyboard.flat() as Array<{ text: string }>;

    // Assert
    expect(buttons.some(b => b.text.includes('إلغاء') || b.text.includes('cancel'))).toBe(false);
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('has custom placeholder configured on persistent reply keyboard for Web & Desktop', () => {
    // Arrange
    const mockCtx = { effectiveRole: 'SUPER_ADMIN' } as MyContext;

    // Act
    const kb = buildPersistentReplyKeyboard(mockCtx);

    // Assert
    expect((kb as any).input_field_placeholder).toBe('اختر إجراءً من القائمة بالأسفل...');
    expect((kb as any).input_field_placeholder).not.toBe('');
  });
});

describe('Dynamic Scoped Bot Commands', () => {
  it('returns Super Admin commands including /settings, /jobs, /sites', () => {
    // Arrange & Act
    const cmds = getCommandsForRole('SUPER_ADMIN');

    // Assert
    expect(cmds.some(c => c.command === 'settings')).toBe(true);
    expect(cmds.some(c => c.command === 'jobs')).toBe(true);
    expect(cmds.some(c => c.command === 'sites')).toBe(true);
    expect(cmds.some(c => c.command === 'cancel')).toBe(true);
  });

  it('masks administrative commands for FIELD_ADMIN and includes /switch_role', () => {
    // Arrange & Act
    const cmds = getCommandsForRole('FIELD_ADMIN');

    // Assert
    expect(cmds.some(c => c.command === 'settings')).toBe(false);
    expect(cmds.some(c => c.command === 'jobs')).toBe(false);
    expect(cmds.some(c => c.command === 'sites')).toBe(false);
    expect(cmds.some(c => c.command === 'switch_role')).toBe(true);
    expect(cmds.some(c => c.command === 'cancel')).toBe(true);
  });

  it('masks administrative commands for WORKER and GUEST', () => {
    // Arrange & Act
    const workerCmds = getCommandsForRole('WORKER');
    const guestCmds = getCommandsForRole('GUEST');

    // Assert
    expect(workerCmds.some(c => c.command === 'settings')).toBe(false);
    expect(workerCmds.some(c => c.command === 'jobs')).toBe(false);
    expect(workerCmds.some(c => c.command === 'cancel')).toBe(true);

    expect(guestCmds.some(c => c.command === 'settings')).toBe(false);
    expect(guestCmds.some(c => c.command === 'apply')).toBe(true);
    expect(guestCmds.some(c => c.command === 'status')).toBe(true);
    expect(guestCmds.some(c => c.command === 'cancel')).toBe(true);
    expect(guestCmds.length).toBe(4);
  });
});
