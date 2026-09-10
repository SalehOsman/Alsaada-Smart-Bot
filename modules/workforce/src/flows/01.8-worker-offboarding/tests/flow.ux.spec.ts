import { describe, it, expect } from 'vitest';
import {
  buildWorkerPickerKeyboard,
  buildReasonKeyboard,
  buildConfirmKeyboard,
  buildSuccessKeyboard,
} from '../flow.keyboard.js';
import {
  formatWorkerSelectHeader,
  formatReasonSelectHeader,
  formatConfirmationCard,
  formatSuccessCard,
} from '../flow.messages.js';

describe('01.8 Worker Offboarding — UX Tests', () => {
  it('should render keyboards complying with Telegram 64-byte callback limits', () => {
    const workerKb = buildWorkerPickerKeyboard([
      { id: 'w-1', name: 'أحمد سعيد', code: 'OP-01' },
      { id: 'w-2', name: 'علي محمود', code: 'OP-02' },
    ]);
    for (const b of workerKb.inline_keyboard.flat()) {
      if ('callback_data' in b && b.callback_data) {
        expect(Buffer.byteLength(b.callback_data, 'utf8')).toBeLessThanOrEqual(64);
      }
    }

    const reasonKb = buildReasonKeyboard();
    for (const b of reasonKb.inline_keyboard.flat()) {
      if ('callback_data' in b && b.callback_data) {
        expect(Buffer.byteLength(b.callback_data, 'utf8')).toBeLessThanOrEqual(64);
      }
    }

    const confirmKb = buildConfirmKeyboard();
    for (const b of confirmKb.inline_keyboard.flat()) {
      if ('callback_data' in b && b.callback_data) {
        expect(Buffer.byteLength(b.callback_data, 'utf8')).toBeLessThanOrEqual(64);
      }
    }
  });

  it('should format confirmation card showing demotion impact when worker has linked telegram', () => {
    const card = formatConfirmationCard('أحمد سعيد', 'OP-01', 'RESIGNATION', true);
    expect(card).toContain('إسقاط الصلاحيات اللحظي');
    expect(card).toContain('زائر (GUEST)');

    const cardNoTelegram = formatConfirmationCard('أحمد سعيد', 'OP-01', 'RESIGNATION', false);
    expect(cardNoTelegram).toContain('ليس لديه حساب تليجرام');
  });

  it('should format success card with clearance reference ID', () => {
    const card = formatSuccessCard('أحمد سعيد', 'OP-01', 'CLR-TEST-99', true);
    expect(card).toContain('CLR-TEST-99');
    expect(card).toContain('تم هبوط حساب التليجرام لدور زائر');
  });
});
