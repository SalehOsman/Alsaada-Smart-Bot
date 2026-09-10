import { describe, it, expect } from 'vitest';
import {
  formatSpoiler,
  formatExpandableQuote,
  formatMonospace,
  buildCopyTextButton,
  buildInputFieldPlaceholder,
} from '../src/formatting/telegram-formatters.js';

describe('Telegram UX Formatters & Components', () => {
  describe('formatSpoiler', () => {
    it('wraps text inside <tg-spoiler> tags by default', () => {
      expect(formatSpoiler('5000 ج.م')).toBe('<tg-spoiler>5000 ج.م</tg-spoiler>');
    });

    it('wraps text inside || tags when mode is markdown', () => {
      expect(formatSpoiler('5000 ج.م', 'markdown')).toBe('||5000 ج.م||');
    });

    it('returns empty string for null, empty or whitespace-only inputs', () => {
      expect(formatSpoiler('')).toBe('');
      expect(formatSpoiler('   ')).toBe('');
    });
  });

  describe('formatExpandableQuote', () => {
    it('wraps multi-line text inside <blockquote expandable> tags by default', () => {
      const notes = 'ملاحظة طبية:\nيعاني من حساسية صدرية ويمنع من العمل في مناطق الأتربة';
      expect(formatExpandableQuote(notes)).toBe(
        '<blockquote expandable>ملاحظة طبية:\nيعاني من حساسية صدرية ويمنع من العمل في مناطق الأتربة</blockquote>'
      );
    });

    it('wraps text inside **> tags when mode is markdown', () => {
      const notes = 'سطر أول\nسطر ثان';
      expect(formatExpandableQuote(notes, 'markdown')).toBe('**>سطر أول\n>سطر ثان**');
    });

    it('returns empty string for empty input', () => {
      expect(formatExpandableQuote('')).toBe('');
    });
  });

  describe('formatMonospace', () => {
    it('wraps text in <code> tags for 1-tap copying', () => {
      expect(formatMonospace('29901011234567')).toBe('<code>29901011234567</code>');
    });

    it('returns empty string for empty input', () => {
      expect(formatMonospace('')).toBe('');
    });
  });

  describe('buildCopyTextButton', () => {
    it('constructs a valid Telegram Bot API 7.10+ copy_text inline button', () => {
      const button = buildCopyTextButton('📋 نسخ إنستاباي', 'emp@instapay');
      expect(button).toEqual({
        text: '📋 نسخ إنستاباي',
        copy_text: {
          text: 'emp@instapay',
        },
      });
    });
  });

  describe('buildInputFieldPlaceholder', () => {
    it('constructs input_field_placeholder object', () => {
      const res = buildInputFieldPlaceholder('اكتب المبلغ بالأرقام...');
      expect(res).toEqual({
        input_field_placeholder: 'اكتب المبلغ بالأرقام...',
      });
    });
  });
});
