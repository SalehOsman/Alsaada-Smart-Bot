import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildPersistentReplyKeyboard,
  buildRemoveReplyKeyboard,
  REMOVE_REPLY_KEYBOARD,
  DASHBOARD_KEYBOARD_BUTTON_TEXT,
} from '../src/keyboards/reply-bar.keyboard.js';
import type { MyContext } from '../src/types/context.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

function extractButtonTexts(keyboard: ReturnType<typeof buildPersistentReplyKeyboard>): string[] {
  const built = keyboard.build();
  const texts: string[] = [];
  for (const row of built) {
    for (const btn of row) {
      if (typeof btn === 'object' && 'text' in btn) {
        texts.push(btn.text);
      }
    }
  }
  return texts;
}

function extractButtonRows(keyboard: ReturnType<typeof buildPersistentReplyKeyboard>): string[][] {
  const built = keyboard.build();
  return built.map(row =>
    row.filter((btn): btn is { text: string } => typeof btn === 'object' && 'text' in btn).map(btn => btn.text)
  );
}

describe('Reply Bar Keyboard & Dedicated Dashboard Button Visibility (Section 4.1 & 4.2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays the dedicated dashboard button for SUPER_ADMIN in private chat', () => {
    // Arrange
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboard = buildPersistentReplyKeyboard(ctx);
    const buttons = extractButtonTexts(keyboard);

    // Assert
    expect(buttons).toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(buttons).toContain('🏠 القائمة الرئيسية');
    expect(buttons).toContain('⚙️ إعدادات النظام');
    expect(buttons).not.toContain('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)');
  });

  it('displays the dedicated dashboard button for GENERAL_ADMIN in private chat and hides settings button', () => {
    // Arrange
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'GENERAL_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboard = buildPersistentReplyKeyboard(ctx);
    const buttons = extractButtonTexts(keyboard);

    // Assert
    expect(buttons).toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(buttons).toContain('🏠 القائمة الرئيسية');
    expect(buttons).not.toContain('⚙️ إعدادات النظام');
    expect(buttons).not.toContain('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)');
  });

  it('displays the dedicated dashboard button for FIELD_ADMIN in private chat', () => {
    // Arrange
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'FIELD_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboard = buildPersistentReplyKeyboard(ctx);
    const buttons = extractButtonTexts(keyboard);

    // Assert
    expect(buttons).toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(buttons).toContain('👷 التبديل لحسابي كعامل');
    expect(buttons).not.toContain('⚙️ إعدادات النظام');
  });

  it('hides the button for FIELD_ADMIN in dual worker mode', () => {
    // Arrange
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'WORKER',
      dbUser: { isActive: true, isBanned: false },
      isDualWorkerMode: true,
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboard = buildPersistentReplyKeyboard(ctx);
    const buttons = extractButtonTexts(keyboard);

    // Assert
    expect(buttons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(buttons).toContain('🛡️ العودة لبوابة الإشراف');
    expect(buttons).not.toContain('⚙️ إعدادات النظام');
  });

  it('hides the button when Super Admin is impersonating a non-admin role (e.g. WORKER)', () => {
    // Arrange
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'WORKER',
      dbUser: { isActive: true, isBanned: false },
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    // Act
    const keyboard = buildPersistentReplyKeyboard(ctx);
    const buttons = extractButtonTexts(keyboard);

    // Assert
    expect(buttons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(buttons).toContain('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)');
    expect(buttons).not.toContain('⚙️ إعدادات النظام');
  });

  it('hides the button in group or supergroup chats even for SUPER_ADMIN', () => {
    // Arrange
    const ctxGroup = {
      chat: { type: 'group' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    const ctxSupergroup = {
      chat: { type: 'supergroup' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboardGroup = buildPersistentReplyKeyboard(ctxGroup);
    const keyboardSupergroup = buildPersistentReplyKeyboard(ctxSupergroup);
    const groupButtons = extractButtonTexts(keyboardGroup);
    const supergroupButtons = extractButtonTexts(keyboardSupergroup);

    // Assert
    expect(groupButtons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(supergroupButtons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(groupButtons).toContain('🏠 القائمة الرئيسية');
    expect(supergroupButtons).toContain('🏠 القائمة الرئيسية');
  });

  it('hides the button for inactive or banned accounts', () => {
    // Arrange
    const ctxInactive = {
      chat: { type: 'private' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: false, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    const ctxBanned = {
      chat: { type: 'private' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: true, isBanned: true },
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const inactiveButtons = extractButtonTexts(buildPersistentReplyKeyboard(ctxInactive));
    const bannedButtons = extractButtonTexts(buildPersistentReplyKeyboard(ctxBanned));

    // Assert
    expect(inactiveButtons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(bannedButtons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(inactiveButtons).toContain('🏠 القائمة الرئيسية');
    expect(bannedButtons).toContain('🏠 القائمة الرئيسية');
  });

  it('hides the button for WORKER_SUPERVISOR, WORKER, SUPPLIER, and GUEST', () => {
    // Arrange
    const roles = ['WORKER_SUPERVISOR', 'WORKER', 'SUPPLIER', 'GUEST'];

    // Act & Assert
    for (const role of roles) {
      const ctx = {
        chat: { type: 'private' },
        effectiveRole: role,
        dbUser: { isActive: true, isBanned: false },
        isImpersonating: false,
      } as unknown as MyContext;

      const buttons = extractButtonTexts(buildPersistentReplyKeyboard(ctx));
      expect(buttons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
      expect(buttons).toContain('🏠 القائمة الرئيسية');
    }
  });

  it('configures persistent reply keyboard with resized, persistent and custom placeholder for Web & Desktop', () => {
    // Arrange
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboard = buildPersistentReplyKeyboard(ctx);

    // Assert
    expect((keyboard as any).is_persistent).toBe(true);
    expect((keyboard as any).resize_keyboard).toBe(true);
    expect((keyboard as any).input_field_placeholder).toBe('اختر إجراءً من القائمة بالأسفل...');
    expect((keyboard as any).one_time_keyboard).toBeFalsy();
  });
});

describe('Ghost Mode Persistent Reply Keyboard & Zero RBAC UI Leakage (Plan 55)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Scenario 1: WORKER simulation — matches worker buttons, exit button in LAST row, zero admin buttons', () => {
    // Arrange
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'WORKER',
      dbUser: { isActive: true, isBanned: false },
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    // Act
    const keyboard = buildPersistentReplyKeyboard(ctx);
    const rows = extractButtonRows(keyboard);
    const allButtons = rows.flat();

    // Assert - Worker layout verification
    expect(allButtons).toContain('🏠 القائمة الرئيسية');
    expect(allButtons).toContain('📊 كشف حسابي');
    expect(allButtons).toContain('🧾 قسيمة راتبي');
    expect(allButtons).toContain('👤 ملفي الشخصي');

    // Assert - Strict Zero RBAC UI Leakage: Super admin buttons must NEVER appear
    expect(allButtons).not.toContain('⚙️ إعدادات النظام');
    expect(allButtons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);

    // Assert - Escape button MUST be in the LAST row (bottom-most row)
    const lastRow = rows[rows.length - 1];
    expect(lastRow).toEqual(['🎭 إنهاء وضع المحاكاة (العودة كمدير عام)']);
    expect(lastRow).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
  });

  it('Scenario 2: SUPPLIER simulation — matches supplier buttons, exit button in LAST row, zero admin buttons', () => {
    // Arrange
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'SUPPLIER',
      dbUser: { isActive: true, isBanned: false },
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    // Act
    const keyboard = buildPersistentReplyKeyboard(ctx);
    const rows = extractButtonRows(keyboard);
    const allButtons = rows.flat();

    // Assert - Supplier layout verification
    expect(allButtons).toContain('🏠 القائمة الرئيسية');
    expect(allButtons).toContain('🧾 فواتيري ومستخلصاتي');
    expect(allButtons).toContain('👤 ملفي الشخصي');

    // Assert - Strict Zero RBAC UI Leakage
    expect(allButtons).not.toContain('⚙️ إعدادات النظام');
    expect(allButtons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);

    // Assert - Escape button in LAST row
    const lastRow = rows[rows.length - 1];
    expect(lastRow).toEqual(['🎭 إنهاء وضع المحاكاة (العودة كمدير عام)']);
    expect(lastRow).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
  });

  it('Scenario 3: GUEST simulation — matches guest buttons, exit button in LAST row, zero admin buttons', () => {
    // Arrange
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'GUEST',
      dbUser: { isActive: true, isBanned: false },
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    // Act
    const keyboard = buildPersistentReplyKeyboard(ctx);
    const rows = extractButtonRows(keyboard);
    const allButtons = rows.flat();

    // Assert - Guest layout verification
    expect(allButtons).toContain('🏠 القائمة الرئيسية');
    expect(allButtons).toContain('🆔 بطاقة معرفي');

    // Assert - Strict Zero RBAC UI Leakage
    expect(allButtons).not.toContain('⚙️ إعدادات النظام');
    expect(allButtons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);

    // Assert - Escape button in LAST row
    const lastRow = rows[rows.length - 1];
    expect(lastRow).toEqual(['🎭 إنهاء وضع المحاكاة (العودة كمدير عام)']);
    expect(lastRow).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
  });

  it('Scenario 4: FIELD_ADMIN simulation — matches field admin buttons, exit button in LAST row, zero settings button', () => {
    // Arrange
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'FIELD_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    // Act
    const keyboard = buildPersistentReplyKeyboard(ctx);
    const rows = extractButtonRows(keyboard);
    const allButtons = rows.flat();

    // Assert - Field admin buttons
    expect(allButtons).toContain('🏠 القائمة الرئيسية');
    expect(allButtons).toContain('👷 التبديل لحسابي كعامل');
    expect(allButtons).toContain('👤 ملفي الشخصي');

    // Assert - Field Admin has dashboard access, but MUST NOT have settings button
    expect(allButtons).not.toContain('⚙️ إعدادات النظام');

    // Assert - Escape button in LAST row
    const lastRow = rows[rows.length - 1];
    expect(lastRow).toEqual(['🎭 إنهاء وضع المحاكاة (العودة كمدير عام)']);
    expect(lastRow).not.toContain('⚙️ إعدادات النظام');
  });

  it('Scenario 5: SUPER_ADMIN native mode (not impersonating) — standard buttons present, exit button absent', () => {
    // Arrange
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isRealSuperAdmin: true,
      isImpersonating: false,
    } as unknown as MyContext;

    // Act
    const keyboard = buildPersistentReplyKeyboard(ctx);
    const rows = extractButtonRows(keyboard);
    const allButtons = rows.flat();

    // Assert
    expect(allButtons).toContain('🏠 القائمة الرئيسية');
    expect(allButtons).toContain('⚙️ إعدادات النظام');
    expect(allButtons).toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);

    // Assert - Simulation exit button must NOT appear in native mode
    expect(allButtons).not.toContain('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)');
    expect(rows.length).toBeGreaterThan(0);
  });

  describe('Wizard Keyboard Isolation (ReplyKeyboardRemove)', () => {
    it('generates valid remove_keyboard payload for multi-step wizards', () => {
      // Arrange & Act
      const removeKb = buildRemoveReplyKeyboard();
      const constantKb = REMOVE_REPLY_KEYBOARD;

      // Assert
      expect(removeKb).toEqual({ remove_keyboard: true });
      expect(constantKb).toEqual({ remove_keyboard: true });
      expect((removeKb as Record<string, unknown>).keyboard).toBeUndefined();
      expect((constantKb as Record<string, unknown>).keyboard).toBeUndefined();
    });
  });
});
