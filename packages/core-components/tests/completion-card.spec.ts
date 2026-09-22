import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeEgyptianPhone,
  buildWhatsAppLink,
  buildCompletionKeyboard,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('UniversalCompletionCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Egyptian phone normalization', () => {
    it('1. normalizes local 11-digit numbers (010, 011, 012, 015) to international format', () => {
      // Arrange
      const raw010 = '01012345678';
      const raw011 = '01198765432';
      const raw012 = '01234567890';
      const raw015 = '01555555555';

      // Act
      const norm010 = normalizeEgyptianPhone(raw010);
      const norm011 = normalizeEgyptianPhone(raw011);
      const norm012 = normalizeEgyptianPhone(raw012);
      const norm015 = normalizeEgyptianPhone(raw015);

      // Assert
      expect(norm010).toBe('201012345678');
      expect(norm011).toBe('201198765432');
      expect(norm012).toBe('201234567890');
      expect(norm015).toBe('201555555555');
    });

    it('2. handles Arabic digits and special characters', () => {
      // Arrange
      const easternPhone = ' ٠١٠١٢٣٤٥٦٧٨ ';
      const dashPhone = '+20-101-234-5678';

      // Act
      const normEastern = normalizeEgyptianPhone(easternPhone);
      const normDash = normalizeEgyptianPhone(dashPhone);

      // Assert
      expect(normEastern).toBe('201012345678');
      expect(normDash).toBe('201012345678');
    });

    it('3. rejects invalid phone numbers with null', () => {
      // Arrange
      const shortPhone = '12345';
      const emptyPhone = '';
      const nullPhone = null;

      // Act
      const normShort = normalizeEgyptianPhone(shortPhone);
      const normEmpty = normalizeEgyptianPhone(emptyPhone);
      const normNull = normalizeEgyptianPhone(nullPhone);

      // Assert
      expect(normShort).toBeNull();
      expect(normEmpty).toBeNull();
      expect(normNull).toBeNull();
    });
  });

  describe('WhatsApp URL generation', () => {
    it('4. builds wa.me link with encoded receipt message', () => {
      // Arrange
      const payload = {
        phoneNumber: '01012345678',
        companyName: 'شركة السعادة',
        voucherNumber: 'ADV-1001',
        operationType: 'سلفة نقدية',
        workerName: 'أحمد محمود',
        amount: 1500,
      };

      // Act
      const link = buildWhatsAppLink(payload);

      // Assert
      expect(link).not.toBeNull();
      expect(link).toContain('https://wa.me/201012345678?text=');
      expect(link).toContain(encodeURIComponent('ADV-1001'));
      expect(link).toContain(encodeURIComponent('1,500.00 ج.م'));
    });
  });

  describe('Universal Post-Action Completion Keyboard (Charter Section 5.2)', () => {
    it('5. strictly renders 4-tier buttons in mandatory sequence', () => {
      // Arrange
      const config = {
        whatsappUrl: 'https://wa.me/201012345678?text=receipt',
        whatsappButtonText: '📲 إرسال إشعار السلفة للعامل عبر واتساب',
        repeatButtonText: '➕ تسجيل سلفة أخرى',
        repeatCallbackData: 'adv:new',
        sectionButtonText: '🔙 العودة لقسم السلف',
        sectionCallbackData: 'adv:menu',
        mainMenuCallbackData: 'action:main_menu',
      };

      // Act
      const kb = buildCompletionKeyboard(config);
      const rows = kb.inline_keyboard;

      // Assert
      expect(rows).toHaveLength(4);

      // 1. WhatsApp Action
      expect(rows[0]![0]!.text).toBe('📲 إرسال إشعار السلفة للعامل عبر واتساب');
      expect((rows[0]![0] as { url?: string }).url).toBe('https://wa.me/201012345678?text=receipt');

      // 2. Repeat operation
      expect(rows[1]![0]!.text).toBe('➕ تسجيل سلفة أخرى');
      expect((rows[1]![0] as { callback_data?: string }).callback_data).toBe('adv:new');

      // 3. Return to Section
      expect(rows[2]![0]!.text).toBe('🔙 العودة لقسم السلف');
      expect((rows[2]![0] as { callback_data?: string }).callback_data).toBe('adv:menu');

      // 4. Return to Main Menu
      expect(rows[3]![0]!.text).toBe('🏠 القائمة الرئيسية');
      expect((rows[3]![0] as { callback_data?: string }).callback_data).toBe('action:main_menu');
    });

    it('6. renders 3-tier buttons when no WhatsApp URL is applicable', () => {
      // Arrange
      const config = {
        repeatButtonText: '➕ تسجيل مسحوب آخر',
        repeatCallbackData: 'canteen:new',
        sectionButtonText: '🔙 العودة لقسم الكانتين',
        sectionCallbackData: 'canteen:menu',
      };

      // Act
      const kb = buildCompletionKeyboard(config);
      const rows = kb.inline_keyboard;

      // Assert
      expect(rows).toHaveLength(3);
      expect(rows[0]![0]!.text).toBe('➕ تسجيل مسحوب آخر');
      expect(rows[1]![0]!.text).toBe('🔙 العودة لقسم الكانتين');
      expect(rows[2]![0]!.text).toBe('🏠 القائمة الرئيسية');
    });
  });
});
