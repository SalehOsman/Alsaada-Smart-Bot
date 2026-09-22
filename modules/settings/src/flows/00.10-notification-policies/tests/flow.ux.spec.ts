import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatPoliciesHubMessage } from '../flow.messages.js';
import { buildPoliciesHubKeyboard } from '../flow.keyboard.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.10 UX Spec — سياسات الإشعارات', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders breadcrumbs and clean layout in hub message', () => {
    // Arrange
    const expectedBreadcrumb = '⚙️ الإعدادات';

    // Act
    const text = formatPoliciesHubMessage();

    // Assert
    expect(text).toContain(expectedBreadcrumb);
    expect(text).toContain('🔔 سياسات الإشعارات');
    expect(text).toContain('جروبات المواقع الميدانية');
    expect(text).not.toContain('undefined');
  });

  it('renders hub keyboard with navigation buttons within Telegram limits', () => {
    // Arrange
    const maxRows = 7;

    // Act
    const kb = buildPoliciesHubKeyboard();

    // Assert
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
    expect(kb.inline_keyboard.length).toBeLessThanOrEqual(maxRows);

    const flatButtons = kb.inline_keyboard.flat();
    expect(flatButtons.some((b) => b.text.includes('جروبات المواقع'))).toBe(true);
    expect(flatButtons.some((b) => b.text.includes('جروب الإدارة العليا'))).toBe(true);

    for (const btn of flatButtons) {
      if ('callback_data' in btn && btn.callback_data) {
        expect(Buffer.byteLength(btn.callback_data, 'utf8')).toBeLessThanOrEqual(64);
      }
    }
  });
});
