import { describe, it, expect } from 'vitest';
import {
  normalizeEgyptianPhone,
  buildWhatsAppLink,
  buildCompletionKeyboard,
} from '../src/index.js';

describe('UniversalCompletionCard', () => {
  describe('Egyptian phone normalization', () => {
    it('normalizes local 11-digit numbers (010, 011, 012, 015) to international format', () => {
      expect(normalizeEgyptianPhone('01012345678')).toBe('201012345678');
      expect(normalizeEgyptianPhone('01198765432')).toBe('201198765432');
      expect(normalizeEgyptianPhone('01234567890')).toBe('201234567890');
      expect(normalizeEgyptianPhone('01555555555')).toBe('201555555555');
    });

    it('handles Arabic digits and special characters', () => {
      expect(normalizeEgyptianPhone(' ٠١٠١٢٣٤٥٦٧٨ ')).toBe('201012345678');
      expect(normalizeEgyptianPhone('+20-101-234-5678')).toBe('201012345678');
    });

    it('rejects invalid phone numbers', () => {
      expect(normalizeEgyptianPhone('12345')).toBeNull();
      expect(normalizeEgyptianPhone('')).toBeNull();
      expect(normalizeEgyptianPhone(null)).toBeNull();
    });
  });

  describe('WhatsApp URL generation', () => {
    it('builds wa.me link with encoded receipt message', () => {
      const link = buildWhatsAppLink({
        phoneNumber: '01012345678',
        companyName: 'شركة السعادة',
        voucherNumber: 'ADV-1001',
        operationType: 'سلفة نقدية',
        workerName: 'أحمد محمود',
        amount: 1500,
      });

      expect(link).not.toBeNull();
      expect(link).toContain('https://wa.me/201012345678?text=');
      expect(link).toContain(encodeURIComponent('ADV-1001'));
      expect(link).toContain(encodeURIComponent('1,500.00 ج.م'));
    });
  });

  describe('Universal Post-Action Completion Keyboard (Charter Section 5.2)', () => {
    it('strictly renders 4-tier buttons in mandatory sequence', () => {
      const kb = buildCompletionKeyboard({
        whatsappUrl: 'https://wa.me/201012345678?text=receipt',
        whatsappButtonText: '📲 إرسال إشعار السلفة للعامل عبر واتساب',
        repeatButtonText: '➕ تسجيل سلفة أخرى',
        repeatCallbackData: 'adv:new',
        sectionButtonText: '🔙 العودة لقسم السلف',
        sectionCallbackData: 'adv:menu',
        mainMenuCallbackData: 'action:main_menu',
      });

      const rows = kb.inline_keyboard;
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

    it('renders 3-tier buttons when no WhatsApp URL is applicable', () => {
      const kb = buildCompletionKeyboard({
        repeatButtonText: '➕ تسجيل مسحوب آخر',
        repeatCallbackData: 'canteen:new',
        sectionButtonText: '🔙 العودة لقسم الكانتين',
        sectionCallbackData: 'canteen:menu',
      });

      const rows = kb.inline_keyboard;
      expect(rows).toHaveLength(3);
      expect(rows[0]![0]!.text).toBe('➕ تسجيل مسحوب آخر');
      expect(rows[1]![0]!.text).toBe('🔙 العودة لقسم الكانتين');
      expect(rows[2]![0]!.text).toBe('🏠 القائمة الرئيسية');
    });
  });
});
