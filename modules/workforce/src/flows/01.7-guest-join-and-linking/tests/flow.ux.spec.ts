import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildGuestSearchCancelKeyboard,
  buildAfterSubmitKeyboard,
  buildAdminDispatchKeyboard,
} from '../flow.keyboard.js';
import {
  formatSearchPrompt,
  formatApplicationSubmitted,
  formatApplicationStatus,
} from '../flow.messages.js';

describe('01.7 Guest Join & WhatsApp Linking — UX Tests', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders clean prompt message for guest join', () => {
    // Arrange
    const keyword1 = 'تقديم طلب انضمام';
    const keyword2 = 'كودك الوظيفي';

    // Act
    const prompt = formatSearchPrompt();

    // Assert
    expect(prompt).toContain(keyword1);
    expect(prompt).toContain(keyword2);
    expect(prompt).not.toContain('undefined');
  });

  it('builds keyboards complying with Telegram 64-byte callback limits', () => {
    // Arrange
    const maxCallbackBytes = 64;

    // Act
    const cancelKb = buildGuestSearchCancelKeyboard();
    const afterKb = buildAfterSubmitKeyboard();

    // Assert
    for (const b of cancelKb.inline_keyboard.flat()) {
      if ('callback_data' in b && b.callback_data) {
        expect(Buffer.byteLength(b.callback_data, 'utf8')).toBeLessThanOrEqual(maxCallbackBytes);
      }
    }
    for (const b of afterKb.inline_keyboard.flat()) {
      if ('callback_data' in b && b.callback_data) {
        expect(Buffer.byteLength(b.callback_data, 'utf8')).toBeLessThanOrEqual(maxCallbackBytes);
      }
    }
    expect(cancelKb.inline_keyboard.flat().some((b) => 'callback_data' in b && b.callback_data === 'invalid_action')).toBe(false);
  });

  it('builds WhatsApp dispatch URL complying with Telegram 512-byte URL limits', () => {
    // Arrange
    const maxUrlBytes = 512;
    const sampleUrl = 'https://wa.me/201012345678?text=Hello%20Worker';

    // Act
    const kb = buildAdminDispatchKeyboard('01012345678', sampleUrl);
    const urlBtn = kb.inline_keyboard.flat().find((b) => 'url' in b);

    // Assert
    expect(urlBtn).toBeDefined();
    if (urlBtn && 'url' in urlBtn) {
      expect(Buffer.byteLength(urlBtn.url, 'utf8')).toBeLessThanOrEqual(maxUrlBytes);
    }
    expect(urlBtn && 'url' in urlBtn ? urlBtn.url : '').not.toBe('');
  });

  it('formats status messages appropriately', () => {
    // Arrange
    const appNotPresent = false;
    const appPresent = true;
    const ticketNo = '#TCK-123';
    const pendingStatus = 'PENDING';

    // Act
    const statusNoApp = formatApplicationStatus(appNotPresent);
    const statusPending = formatApplicationStatus(appPresent, ticketNo, pendingStatus);

    // Assert
    expect(statusNoApp).toContain('لا يوجد لديك أي طلب انضمام');
    expect(statusPending).toContain('#TCK-123');
    expect(statusPending).toContain('بانتظار إرسال رابط التفعيل');
    expect(statusPending).not.toContain('لا يوجد لديك أي طلب انضمام');
  });
});
