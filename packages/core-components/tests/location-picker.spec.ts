import { describe, it, expect } from 'vitest';
import {
  parseTelegramLocation,
  formatLocationPromptCard,
  buildLocationPromptKeyboard,
} from '../src/location-picker/index.js';

function cbData(btn: unknown): string | undefined {
  return (btn as { callback_data?: string })?.callback_data;
}

describe('Universal Location Picker', () => {
  describe('parseTelegramLocation', () => {
    it('should parse valid coordinates from message.location', () => {
      const ctx = {
        message: {
          location: {
            latitude: 29.9668,
            longitude: 32.5498,
          },
        },
      };
      const result = parseTelegramLocation(ctx);
      expect(result).not.toBeNull();
      expect(result?.latitude).toBeCloseTo(29.9668);
      expect(result?.longitude).toBeCloseTo(32.5498);
    });

    it('should parse coordinates from string numbers safely', () => {
      const ctx = {
        message: {
          location: {
            latitude: '30.0444',
            longitude: '31.2357',
          },
        },
      };
      const result = parseTelegramLocation(ctx);
      expect(result).not.toBeNull();
      expect(result?.latitude).toBeCloseTo(30.0444);
      expect(result?.longitude).toBeCloseTo(31.2357);
    });

    it('should return null when coordinates are out of valid range', () => {
      const ctx1 = {
        message: {
          location: {
            latitude: 95.0,
            longitude: 32.0,
          },
        },
      };
      expect(parseTelegramLocation(ctx1)).toBeNull();

      const ctx2 = {
        message: {
          location: {
            latitude: 30.0,
            longitude: -190.0,
          },
        },
      };
      expect(parseTelegramLocation(ctx2)).toBeNull();
    });

    it('should parse coordinates from Telegram venue object', () => {
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
      const result = parseTelegramLocation(ctx);
      expect(result).not.toBeNull();
      expect(result?.latitude).toBeCloseTo(30.0444);
      expect(result?.longitude).toBeCloseTo(31.2357);
    });

    it('should parse coordinates from plain text message format', () => {
      const ctxComma = {
        message: {
          text: '29.9668, 32.5498',
        },
      };
      const resComma = parseTelegramLocation(ctxComma);
      expect(resComma).not.toBeNull();
      expect(resComma?.latitude).toBeCloseTo(29.9668);
      expect(resComma?.longitude).toBeCloseTo(32.5498);

      const ctxSpace = {
        message: {
          text: '29.9668 32.5498',
        },
      };
      const resSpace = parseTelegramLocation(ctxSpace);
      expect(resSpace).not.toBeNull();
      expect(resSpace?.latitude).toBeCloseTo(29.9668);
      expect(resSpace?.longitude).toBeCloseTo(32.5498);
    });

    it('should parse coordinates from Google Maps URL', () => {
      const ctx = {
        message: {
          text: 'https://maps.google.com/?q=30.0444,31.2357',
        },
      };
      const result = parseTelegramLocation(ctx);
      expect(result).not.toBeNull();
      expect(result?.latitude).toBeCloseTo(30.0444);
      expect(result?.longitude).toBeCloseTo(31.2357);
    });

    it('should return null when context has no location', () => {
      expect(parseTelegramLocation({})).toBeNull();
      expect(parseTelegramLocation({ message: { text: 'random text not coordinates' } })).toBeNull();
      expect(parseTelegramLocation(null)).toBeNull();
      expect(parseTelegramLocation(undefined)).toBeNull();
    });
  });

  describe('formatLocationPromptCard', () => {
    it('should format default card with breadcrumbs and instructions', () => {
      const card = formatLocationPromptCard({ siteName: 'موقع السويس' });
      expect(card).toContain('موقع السويس');
      expect(card).toContain('الخطوة 4 من 5');
      expect(card).toContain('الموقع (Location)');
      expect(card).toContain('📎');
    });

    it('should accept custom breadcrumbs and title', () => {
      const card = formatLocationPromptCard({
        breadcrumbs: ['⚙️', 'المواقع', 'تحديث'],
        title: '📍 *تحديث الإحداثيات*',
      });
      expect(card).toContain('تحديث الإحداثيات');
      expect(card).not.toContain('الخطوة 4 من 5');
    });
  });

  describe('buildLocationPromptKeyboard', () => {
    it('should build keyboard with skip, back, and cancel buttons', () => {
      const kb = buildLocationPromptKeyboard({
        skipCallbackData: 'action:site:add:skip_location',
        backCallbackData: 'action:site:add:back_to_gov',
        cancelCallbackData: 'action:settings:sites_hub',
      });

      expect(kb.inline_keyboard).toHaveLength(2);
      // Row 1: skip button
      expect(kb.inline_keyboard[0]![0]!.text).toBe('⏭️ تخطي (بدون إحداثيات الآن)');
      expect(cbData(kb.inline_keyboard[0]![0])).toBe('action:site:add:skip_location');

      // Row 2: back & cancel buttons
      expect(kb.inline_keyboard[1]![0]!.text).toBe('◀️ السابق');
      expect(cbData(kb.inline_keyboard[1]![0])).toBe('action:site:add:back_to_gov');
      expect(kb.inline_keyboard[1]![1]!.text).toBe('❌ إلغاء');
      expect(cbData(kb.inline_keyboard[1]![1])).toBe('action:settings:sites_hub');
    });

    it('should omit skip row if skipCallbackData is not provided', () => {
      const kb = buildLocationPromptKeyboard({
        cancelCallbackData: 'action:site:view:STE-01',
        cancelText: '❌ إلغاء والعودة',
      });

      expect(kb.inline_keyboard).toHaveLength(1);
      expect(kb.inline_keyboard[0]![0]!.text).toBe('❌ إلغاء والعودة');
      expect(cbData(kb.inline_keyboard[0]![0])).toBe('action:site:view:STE-01');
    });
  });
});
