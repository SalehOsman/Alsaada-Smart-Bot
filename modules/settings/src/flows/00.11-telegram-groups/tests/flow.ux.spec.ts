import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatGroupsHubMessage } from '../flow.messages.js';
import { buildGroupsHubKeyboard } from '../flow.keyboard.js';
import type { SiteGroupItemDto } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.11 UX Spec — مجموعات تليجرام', () => {
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
    const hubStatus = {
      chatId: '-10012345',
      isBound: true,
      topicsConfigured: true,
      topics: {},
    };
    const sites: SiteGroupItemDto[] = [];

    // Act
    const text = formatGroupsHubMessage(hubStatus, sites);

    // Assert
    expect(text).toContain('⚙️ الإعدادات');
    expect(text).toContain('🏛️ إدارة المجموعات');
    expect(text).toContain('جروب الإدارة العليا');
    expect(text).not.toContain('undefined');
  });

  it('renders hub keyboard with navigation buttons within Telegram limits', () => {
    // Arrange
    const unboundStatus = {
      chatId: null,
      isBound: false,
      topicsConfigured: false,
      topics: {},
    };

    // Act
    const kb = buildGroupsHubKeyboard(unboundStatus);

    // Assert
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
    expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);

    const flatButtons = kb.inline_keyboard.flat();
    expect(flatButtons.some((b) => b.text.includes('جروب الإدارة العليا'))).toBe(true);
    expect(flatButtons.some((b) => b.text.includes('مصفوفة ربط جروبات المواقع'))).toBe(true);

    for (const btn of flatButtons) {
      if ('callback_data' in btn && btn.callback_data) {
        expect(Buffer.byteLength(btn.callback_data, 'utf8')).toBeLessThanOrEqual(64);
      }
    }
  });
});
