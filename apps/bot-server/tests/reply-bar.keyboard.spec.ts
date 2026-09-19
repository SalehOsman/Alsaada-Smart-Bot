import { describe, it, expect } from 'vitest';
import {
  buildPersistentReplyKeyboard,
  buildRemoveReplyKeyboard,
  REMOVE_REPLY_KEYBOARD,
  DASHBOARD_KEYBOARD_BUTTON_TEXT,
} from '../src/keyboards/reply-bar.keyboard.js';
import type { MyContext } from '../src/types/context.js';

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

describe('Reply Bar Keyboard & Dedicated Dashboard Button Visibility (Section 4.1 & 4.2)', () => {
  it('displays the dedicated dashboard button for SUPER_ADMIN in private chat', () => {
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildPersistentReplyKeyboard(ctx);
    const buttons = extractButtonTexts(keyboard);

    expect(buttons).toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(buttons).toContain('🏠 القائمة الرئيسية');
    expect(buttons).toContain('⚙️ إعدادات النظام');
  });

  it('displays the dedicated dashboard button for GENERAL_ADMIN in private chat and hides settings button', () => {
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'GENERAL_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildPersistentReplyKeyboard(ctx);
    const buttons = extractButtonTexts(keyboard);

    expect(buttons).toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(buttons).toContain('🏠 القائمة الرئيسية');
    expect(buttons).not.toContain('⚙️ إعدادات النظام');
  });

  it('displays the dedicated dashboard button for FIELD_ADMIN in private chat', () => {
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'FIELD_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildPersistentReplyKeyboard(ctx);
    const buttons = extractButtonTexts(keyboard);

    expect(buttons).toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(buttons).toContain('👷 التبديل لحسابي كعامل');
  });

  it('HIDES the button for FIELD_ADMIN in dual worker mode', () => {
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'WORKER',
      dbUser: { isActive: true, isBanned: false },
      isDualWorkerMode: true,
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildPersistentReplyKeyboard(ctx);
    const buttons = extractButtonTexts(keyboard);

    expect(buttons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(buttons).toContain('🛡️ العودة لبوابة الإشراف');
  });

  it('HIDES the button when Super Admin is impersonating a non-admin role (e.g. WORKER)', () => {
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'WORKER',
      dbUser: { isActive: true, isBanned: false },
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    const keyboard = buildPersistentReplyKeyboard(ctx);
    const buttons = extractButtonTexts(keyboard);

    expect(buttons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    expect(buttons).toContain('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)');
  });

  it('HIDES the button in group or supergroup chats even for SUPER_ADMIN', () => {
    const ctxGroup = {
      chat: { type: 'group' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboardGroup = buildPersistentReplyKeyboard(ctxGroup);
    expect(extractButtonTexts(keyboardGroup)).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);

    const ctxSupergroup = {
      chat: { type: 'supergroup' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboardSupergroup = buildPersistentReplyKeyboard(ctxSupergroup);
    expect(extractButtonTexts(keyboardSupergroup)).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
  });

  it('HIDES the button for inactive or banned accounts', () => {
    const ctxInactive = {
      chat: { type: 'private' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: false, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    expect(extractButtonTexts(buildPersistentReplyKeyboard(ctxInactive))).not.toContain(
      DASHBOARD_KEYBOARD_BUTTON_TEXT
    );

    const ctxBanned = {
      chat: { type: 'private' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: true, isBanned: true },
      isImpersonating: false,
    } as unknown as MyContext;

    expect(extractButtonTexts(buildPersistentReplyKeyboard(ctxBanned))).not.toContain(
      DASHBOARD_KEYBOARD_BUTTON_TEXT
    );
  });

  it('HIDES the button for WORKER_SUPERVISOR, WORKER, SUPPLIER, and GUEST', () => {
    const roles = ['WORKER_SUPERVISOR', 'WORKER', 'SUPPLIER', 'GUEST'];
    for (const role of roles) {
      const ctx = {
        chat: { type: 'private' },
        effectiveRole: role,
        dbUser: { isActive: true, isBanned: false },
        isImpersonating: false,
      } as unknown as MyContext;

      const buttons = extractButtonTexts(buildPersistentReplyKeyboard(ctx));
      expect(buttons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
    }
  });

  it('configures persistent reply keyboard with resized, persistent and custom placeholder for Web & Desktop', () => {
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildPersistentReplyKeyboard(ctx);
    expect((keyboard as any).is_persistent).toBe(true);
    expect((keyboard as any).resize_keyboard).toBe(true);
    expect((keyboard as any).input_field_placeholder).toBe('اختر إجراءً من القائمة بالأسفل...');
  });
});

function extractButtonRows(keyboard: ReturnType<typeof buildPersistentReplyKeyboard>): string[][] {
  const built = keyboard.build();
  return built.map(row =>
    row.filter((btn): btn is { text: string } => typeof btn === 'object' && 'text' in btn).map(btn => btn.text)
  );
}

describe('Ghost Mode Persistent Reply Keyboard & Zero RBAC UI Leakage (Plan 55)', () => {
  it('Scenario 1: WORKER simulation — matches worker buttons, exit button in LAST row, zero admin buttons', () => {
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'WORKER',
      dbUser: { isActive: true, isBanned: false },
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    const keyboard = buildPersistentReplyKeyboard(ctx);
    const rows = extractButtonRows(keyboard);
    const allButtons = rows.flat();

    // Worker layout verification
    expect(allButtons).toContain('🏠 القائمة الرئيسية');
    expect(allButtons).toContain('📊 كشف حسابي');
    expect(allButtons).toContain('🧾 قسيمة راتبي');
    expect(allButtons).toContain('👤 ملفي الشخصي');

    // Strict Zero RBAC UI Leakage: Super admin buttons must NEVER appear
    expect(allButtons).not.toContain('⚙️ إعدادات النظام');
    expect(allButtons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);

    // Escape button MUST be in the LAST row (bottom-most row)
    const lastRow = rows[rows.length - 1];
    expect(lastRow).toEqual(['🎭 إنهاء وضع المحاكاة (العودة كمدير عام)']);
  });

  it('Scenario 2: SUPPLIER simulation — matches supplier buttons, exit button in LAST row, zero admin buttons', () => {
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'SUPPLIER',
      dbUser: { isActive: true, isBanned: false },
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    const keyboard = buildPersistentReplyKeyboard(ctx);
    const rows = extractButtonRows(keyboard);
    const allButtons = rows.flat();

    // Supplier layout verification
    expect(allButtons).toContain('🏠 القائمة الرئيسية');
    expect(allButtons).toContain('🧾 فواتيري ومستخلصاتي');
    expect(allButtons).toContain('👤 ملفي الشخصي');

    // Strict Zero RBAC UI Leakage
    expect(allButtons).not.toContain('⚙️ إعدادات النظام');
    expect(allButtons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);

    // Escape button in LAST row
    const lastRow = rows[rows.length - 1];
    expect(lastRow).toEqual(['🎭 إنهاء وضع المحاكاة (العودة كمدير عام)']);
  });

  it('Scenario 3: GUEST simulation — matches guest buttons, exit button in LAST row, zero admin buttons', () => {
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'GUEST',
      dbUser: { isActive: true, isBanned: false },
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    const keyboard = buildPersistentReplyKeyboard(ctx);
    const rows = extractButtonRows(keyboard);
    const allButtons = rows.flat();

    // Guest layout verification
    expect(allButtons).toContain('🏠 القائمة الرئيسية');
    expect(allButtons).toContain('🆔 بطاقة معرفي');

    // Strict Zero RBAC UI Leakage
    expect(allButtons).not.toContain('⚙️ إعدادات النظام');
    expect(allButtons).not.toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);

    // Escape button in LAST row
    const lastRow = rows[rows.length - 1];
    expect(lastRow).toEqual(['🎭 إنهاء وضع المحاكاة (العودة كمدير عام)']);
  });

  it('Scenario 4: FIELD_ADMIN simulation — matches field admin buttons, exit button in LAST row, zero settings button', () => {
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'FIELD_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isRealSuperAdmin: true,
      isImpersonating: true,
    } as unknown as MyContext;

    const keyboard = buildPersistentReplyKeyboard(ctx);
    const rows = extractButtonRows(keyboard);
    const allButtons = rows.flat();

    // Field admin buttons
    expect(allButtons).toContain('🏠 القائمة الرئيسية');
    expect(allButtons).toContain('👷 التبديل لحسابي كعامل');
    expect(allButtons).toContain('👤 ملفي الشخصي');

    // Field Admin has dashboard access, but MUST NOT have settings button
    expect(allButtons).not.toContain('⚙️ إعدادات النظام');

    // Escape button in LAST row
    const lastRow = rows[rows.length - 1];
    expect(lastRow).toEqual(['🎭 إنهاء وضع المحاكاة (العودة كمدير عام)']);
  });

  it('Scenario 5: SUPER_ADMIN native mode (not impersonating) — standard buttons present, exit button absent', () => {
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isRealSuperAdmin: true,
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildPersistentReplyKeyboard(ctx);
    const rows = extractButtonRows(keyboard);
    const allButtons = rows.flat();

    expect(allButtons).toContain('🏠 القائمة الرئيسية');
    expect(allButtons).toContain('⚙️ إعدادات النظام');
    expect(allButtons).toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);

    // Simulation exit button must NOT appear in native mode
    expect(allButtons).not.toContain('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)');
  });

  describe('Wizard Keyboard Isolation (ReplyKeyboardRemove)', () => {
    it('should generate valid remove_keyboard payload for multi-step wizards', () => {
      expect(buildRemoveReplyKeyboard()).toEqual({ remove_keyboard: true });
      expect(REMOVE_REPLY_KEYBOARD).toEqual({ remove_keyboard: true });
    });
  });
});
