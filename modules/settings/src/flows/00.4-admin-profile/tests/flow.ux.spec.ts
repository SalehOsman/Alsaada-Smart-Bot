import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildAdminProfileKeyboard,
  buildFieldAdminProfileKeyboard,
  buildCancelAdminEditKeyboard,
} from '../flow.keyboard.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.4 UX Tests — الملف الشخصي للمدير العام', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('generates standard admin profile inline keyboard without impersonation button', () => {
    // Arrange
    const isImpersonating = false;

    // Act
    const kb = buildAdminProfileKeyboard(isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
    const hasExitImpersonate = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasExitImpersonate).toBe(false);
  });

  it('injects exit impersonation button into admin profile keyboard during simulation', () => {
    // Arrange
    const isImpersonating = true;

    // Act
    const kb = buildAdminProfileKeyboard(isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    const hasExitImpersonate = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasExitImpersonate).toBe(true);
  });

  it('renders field admin profile keyboard with worker self-service switcher', () => {
    // Arrange
    const isImpersonating = false;

    // Act
    const kb = buildFieldAdminProfileKeyboard(isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    const switchBtn = kb.inline_keyboard[0]?.[0];
    expect(switchBtn && 'callback_data' in switchBtn ? switchBtn.callback_data : '').toBe('action:switch_identity:worker');
  });

  it('renders cancel keyboard pointing back to admin profile card', () => {
    // Arrange
    const noop = null;

    // Act
    const kb = buildCancelAdminEditKeyboard();

    // Assert
    expect(kb).toBeDefined();
    const cancelBtn = kb.inline_keyboard[0]?.[0];
    expect(cancelBtn && 'callback_data' in cancelBtn ? cancelBtn.callback_data : '').toBe('action:settings:admin_profile');
  });
});
