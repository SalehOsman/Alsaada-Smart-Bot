import { describe, it, expect } from 'vitest';
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
  it('should render clean prompt message for guest join', () => {
    const prompt = formatSearchPrompt();
    expect(prompt).toContain('تقديم طلب انضمام');
    expect(prompt).toContain('كودك الوظيفي');
  });

  it('should build keyboards complying with Telegram 64-byte callback limits', () => {
    const cancelKb = buildGuestSearchCancelKeyboard();
    for (const b of cancelKb.inline_keyboard.flat()) {
      if ('callback_data' in b && b.callback_data) {
        expect(Buffer.byteLength(b.callback_data, 'utf8')).toBeLessThanOrEqual(64);
      }
    }

    const afterKb = buildAfterSubmitKeyboard();
    for (const b of afterKb.inline_keyboard.flat()) {
      if ('callback_data' in b && b.callback_data) {
        expect(Buffer.byteLength(b.callback_data, 'utf8')).toBeLessThanOrEqual(64);
      }
    }
  });

  it('should build WhatsApp dispatch URL complying with Telegram 512-byte URL limits', () => {
    const sampleUrl = 'https://wa.me/201012345678?text=Hello%20Worker';
    const kb = buildAdminDispatchKeyboard('01012345678', sampleUrl);
    const urlBtn = kb.inline_keyboard.flat().find((b) => 'url' in b);

    expect(urlBtn).toBeDefined();
    if (urlBtn && 'url' in urlBtn) {
      expect(Buffer.byteLength(urlBtn.url, 'utf8')).toBeLessThanOrEqual(512);
    }
  });

  it('should format status messages appropriately', () => {
    const statusNoApp = formatApplicationStatus(false);
    expect(statusNoApp).toContain('لا يوجد لديك أي طلب انضمام');

    const statusPending = formatApplicationStatus(true, '#TCK-123', 'PENDING');
    expect(statusPending).toContain('#TCK-123');
    expect(statusPending).toContain('بانتظار إرسال رابط التفعيل');
  });
});
