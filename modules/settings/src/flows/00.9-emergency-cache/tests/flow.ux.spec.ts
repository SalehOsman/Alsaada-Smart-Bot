import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildEmergencyCacheKeyboard,
  buildConfirmMaintenanceKeyboard,
} from '../flow.keyboard.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.9 UX Tests — صمامات الطوارئ والذاكرة اللحظية', () => {
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

  it('renders emergency cache keyboard with lock activation button when maintenance is inactive', () => {
    // Arrange
    const isMaintenanceActive = false;
    const isImpersonating = false;

    // Act
    const kb = buildEmergencyCacheKeyboard(isMaintenanceActive, isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
    const toggleBtn = kb.inline_keyboard[0]?.[0];
    expect(toggleBtn && 'callback_data' in toggleBtn ? toggleBtn.callback_data : '').toBe('action:emergency:confirm_maintenance_prompt');
    const hasExit = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasExit).toBe(false);
  });

  it('renders disable maintenance option and injects exit button during impersonation', () => {
    // Arrange
    const isMaintenanceActive = true;
    const isImpersonating = true;

    // Act
    const kb = buildEmergencyCacheKeyboard(isMaintenanceActive, isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    const toggleBtn = kb.inline_keyboard[0]?.[0];
    expect(toggleBtn && 'callback_data' in toggleBtn ? toggleBtn.callback_data : '').toBe('action:emergency:toggle_maintenance');
    const hasExit = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasExit).toBe(true);
  });

  it('renders confirmation modal keyboard with immediate lockdown action', () => {
    // Arrange
    const noop = null;

    // Act
    const kb = buildConfirmMaintenanceKeyboard();

    // Assert
    expect(kb).toBeDefined();
    const confirmBtn = kb.inline_keyboard[0]?.[0];
    const cancelBtn = kb.inline_keyboard[1]?.[0];
    expect(confirmBtn && 'callback_data' in confirmBtn ? confirmBtn.callback_data : '').toBe('action:emergency:toggle_maintenance');
    expect(cancelBtn && 'callback_data' in cancelBtn ? cancelBtn.callback_data : '').toBe('action:settings:emergency_cache');
  });
});
