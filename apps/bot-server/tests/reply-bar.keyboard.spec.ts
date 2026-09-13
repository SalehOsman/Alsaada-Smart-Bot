import { describe, it, expect } from 'vitest';
import {
  buildPersistentReplyKeyboard,
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

  it('displays the dedicated dashboard button for GENERAL_ADMIN in private chat', () => {
    const ctx = {
      chat: { type: 'private' },
      effectiveRole: 'GENERAL_ADMIN',
      dbUser: { isActive: true, isBanned: false },
      isImpersonating: false,
    } as unknown as MyContext;

    const keyboard = buildPersistentReplyKeyboard(ctx);
    const buttons = extractButtonTexts(keyboard);

    expect(buttons).toContain(DASHBOARD_KEYBOARD_BUTTON_TEXT);
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
});
