import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildApmDashboardKeyboard,
  buildSlowOpsKeyboard,
  buildAlertPolicyKeyboard,
} from '../flow.keyboard.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.8 UX Tests — رادار الأداء ومراقبة الخدمات', () => {
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

  it('generates APM dashboard inline keyboard without simulation exit button', () => {
    // Arrange
    const isImpersonating = false;

    // Act
    const kb = buildApmDashboardKeyboard(isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
    const hasExit = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasExit).toBe(false);
  });

  it('injects simulation exit button when impersonating supervisor in APM view', () => {
    // Arrange
    const isImpersonating = true;

    // Act
    const kb = buildApmDashboardKeyboard(isImpersonating);

    // Assert
    expect(kb).toBeDefined();
    const hasExit = kb.inline_keyboard.some((row) =>
      row.some((btn) => 'callback_data' in btn && btn.callback_data === 'action:exit_impersonate')
    );
    expect(hasExit).toBe(true);
  });

  it('renders slow operations keyboard with refresh action button', () => {
    // Arrange
    const noop = null;

    // Act
    const kb = buildSlowOpsKeyboard();

    // Assert
    expect(kb).toBeDefined();
    const refreshBtn = kb.inline_keyboard[0]?.[0];
    expect(refreshBtn && 'callback_data' in refreshBtn ? refreshBtn.callback_data : '').toBe('action:apm:slow_ops');
  });

  it('renders alert policy radio indicators matching current active selection', () => {
    // Arrange
    const activePolicy = 'SMART';

    // Act
    const kb = buildAlertPolicyKeyboard(activePolicy);

    // Assert
    expect(kb).toBeDefined();
    const smartBtn = kb.inline_keyboard[1]?.[0];
    const immediateBtn = kb.inline_keyboard[0]?.[0];
    expect(smartBtn?.text).toContain('🔘');
    expect(immediateBtn?.text).toContain('⚪');
  });
});
