import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseTelegramLocation,
  formatLocationPromptCard,
  buildLocationPromptKeyboard,
} from '../src/location-picker/index.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

function cbData(btn: unknown): string | undefined {
  return (btn as { callback_data?: string })?.callback_data;
}

describe('Universal Location Picker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  describe('parseTelegramLocation', () => {
    it('1. parses valid coordinates from message.location', () => {
      // Arrange
      const ctx = {
        message: {
          location: {
            latitude: 29.9668,
            longitude: 32.5498,
          },
        },
      };

      // Act
      const result = parseTelegramLocation(ctx);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.latitude).toBeCloseTo(29.9668);
      expect(result?.longitude).toBeCloseTo(32.5498);
      expect(result?.latitude).not.toBe(0);
    });

    it('2. parses coordinates from string numbers safely', () => {
      // Arrange
      const ctx = {
        message: {
          location: {
            latitude: '30.0444',
            longitude: '31.2357',
          },
        },
      };

      // Act
      const result = parseTelegramLocation(ctx);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.latitude).toBeCloseTo(30.0444);
      expect(result?.longitude).toBeCloseTo(31.2357);
      expect(typeof result?.latitude).toBe('number');
    });

    it('3. returns null when coordinates are out of valid range', () => {
      // Arrange
      const ctx1 = {
        message: {
          location: {
            latitude: 95.0,
            longitude: 32.0,
          },
        },
      };
      const ctx2 = {
        message: {
          location: {
            latitude: 30.0,
            longitude: -190.0,
          },
        },
      };

      // Act
      const res1 = parseTelegramLocation(ctx1);
      const res2 = parseTelegramLocation(ctx2);

      // Assert
      expect(res1).toBeNull();
      expect(res2).toBeNull();
      expect(res1).toBeFalsy();
    });

    it('4. parses coordinates from Telegram venue object', () => {
      // Arrange
      const ctx = {
        message: {
          venue: {
            location: {
              latitude: 30.0444,
              longitude: 31.2357,
            },
            title: 'Cairo Site',
            address: 'Cairo, Egypt',
          },
        },
      };

      // Act
      const result = parseTelegramLocation(ctx);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.latitude).toBeCloseTo(30.0444);
      expect(result?.longitude).toBeCloseTo(31.2357);
      expect(result?.latitude).not.toBeLessThan(0);
    });

    it('5. parses coordinates from plain text message format', () => {
      // Arrange
      const ctxComma = {
        message: {
          text: '29.9668, 32.5498',
        },
      };
      const ctxSpace = {
        message: {
          text: '29.9668 32.5498',
        },
      };

      // Act
      const resComma = parseTelegramLocation(ctxComma);
      const resSpace = parseTelegramLocation(ctxSpace);

      // Assert
      expect(resComma).not.toBeNull();
      expect(resComma?.latitude).toBeCloseTo(29.9668);
      expect(resComma?.longitude).toBeCloseTo(32.5498);

      expect(resSpace).not.toBeNull();
      expect(resSpace?.latitude).toBeCloseTo(29.9668);
      expect(resSpace?.longitude).toBeCloseTo(32.5498);
      expect(resComma?.latitude).not.toBe(resSpace?.longitude);
    });

    it('6. parses coordinates from Google Maps URL', () => {
      // Arrange
      const ctx = {
        message: {
          text: 'https://maps.google.com/?q=30.0444,31.2357',
        },
      };

      // Act
      const result = parseTelegramLocation(ctx);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.latitude).toBeCloseTo(30.0444);
      expect(result?.longitude).toBeCloseTo(31.2357);
      expect(result?.latitude).not.toBe(0);
    });

    it('7. returns null when context has no location', () => {
      // Arrange
      const emptyCtx = {};
      const randomTextCtx = { message: { text: 'random text not coordinates' } };
      const nullCtx = null;
      const undefinedCtx = undefined;

      // Act
      const resEmpty = parseTelegramLocation(emptyCtx);
      const resRandom = parseTelegramLocation(randomTextCtx);
      const resNull = parseTelegramLocation(nullCtx);
      const resUndefined = parseTelegramLocation(undefinedCtx);

      // Assert
      expect(resEmpty).toBeNull();
      expect(resRandom).toBeNull();
      expect(resNull).toBeNull();
      expect(resUndefined).toBeNull();
    });
  });

  describe('formatLocationPromptCard', () => {
    it('8. formats default card with breadcrumbs and instructions', () => {
      // Arrange
      const input = { siteName: 'موقع السويس' };

      // Act
      const card = formatLocationPromptCard(input);

      // Assert
      expect(card).toContain('موقع السويس');
      expect(card).toContain('الخطوة 4 من 5');
      expect(card).toContain('الموقع (Location)');
      expect(card).toContain('📎');
      expect(card).not.toContain('خطأ');
    });

    it('9. accepts custom breadcrumbs and title', () => {
      // Arrange
      const input = {
        breadcrumbs: ['⚙️', 'المواقع', 'تحديث'],
        title: '📍 *تحديث الإحداثيات*',
      };

      // Act
      const card = formatLocationPromptCard(input);

      // Assert
      expect(card).toContain('تحديث الإحداثيات');
      expect(card).not.toContain('الخطوة 4 من 5');
    });
  });

  describe('buildLocationPromptKeyboard', () => {
    it('10. builds keyboard with skip, back, and cancel buttons', () => {
      // Arrange
      const opts = {
        skipCallbackData: 'action:site:add:skip_location',
        backCallbackData: 'action:site:add:back_to_gov',
        cancelCallbackData: 'action:settings:sites_hub',
      };

      // Act
      const kb = buildLocationPromptKeyboard(opts);

      // Assert
      expect(kb.inline_keyboard).toHaveLength(2);
      // Row 1: skip button
      expect(kb.inline_keyboard[0]![0]!.text).toBe('⏭️ تخطي (بدون إحداثيات الآن)');
      expect(cbData(kb.inline_keyboard[0]![0])).toBe('action:site:add:skip_location');

      // Row 2: back & cancel buttons
      expect(kb.inline_keyboard[1]![0]!.text).toBe('◀️ السابق');
      expect(cbData(kb.inline_keyboard[1]![0])).toBe('action:site:add:back_to_gov');
      expect(kb.inline_keyboard[1]![1]!.text).toBe('❌ إلغاء');
      expect(cbData(kb.inline_keyboard[1]![1])).toBe('action:settings:sites_hub');
      expect(kb.inline_keyboard[0]![0]!.text).not.toBe(kb.inline_keyboard[1]![0]!.text);
    });

    it('11. omits skip row if skipCallbackData is not provided', () => {
      // Arrange
      const opts = {
        cancelCallbackData: 'action:site:view:STE-01',
        cancelText: '❌ إلغاء والعودة',
      };

      // Act
      const kb = buildLocationPromptKeyboard(opts);

      // Assert
      expect(kb.inline_keyboard).toHaveLength(1);
      expect(kb.inline_keyboard[0]![0]!.text).toBe('❌ إلغاء والعودة');
      expect(cbData(kb.inline_keyboard[0]![0])).toBe('action:site:view:STE-01');
      expect(cbData(kb.inline_keyboard[0]![0])).not.toContain('skip');
    });
  });
});
