import { describe, it, expect, vi } from 'vitest';
import {
  formatBreadcrumbs,
  formatSpoiler,
  formatExpandableQuote,
  formatMonospace,
  formatClickToCopy,
  buildCopyTextButton,
  buildInputFieldPlaceholder,
  DISABLED_LINK_PREVIEWS,
  buildLinkPreviewOptions,
  buildModalAlertOptions,
  showModalAlert,
  sendChatActionSafe,
  withChatAction,
} from '../src/formatting/telegram-formatters.js';

describe('Telegram UX Formatters & Components', () => {
  describe('formatBreadcrumbs', () => {
    it('formats multi-segment breadcrumbs with ❯ separator', () => {
      const result = formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان المؤسسي', '🏗️ مصفوفة المشاريع']);
      expect(result).toBe('📍 *المسار:* ⚙️ الإعدادات ❯ 🏢 الكيان المؤسسي ❯ 🏗️ مصفوفة المشاريع\n\n');
    });

    it('filters out empty or whitespace-only segments', () => {
      const result = formatBreadcrumbs(['⚙️ الإعدادات', '   ', '', '👤 ملفي الشخصي']);
      expect(result).toBe('📍 *المسار:* ⚙️ الإعدادات ❯ 👤 ملفي الشخصي\n\n');
    });

    it('returns empty string when given empty array', () => {
      expect(formatBreadcrumbs([])).toBe('');
    });
  });

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

  describe('formatMonospace & formatClickToCopy', () => {
    it('wraps text in <code> tags for 1-tap copying', () => {
      expect(formatMonospace('29901011234567')).toBe('<code>29901011234567</code>');
    });

    it('formatClickToCopy supports strings, numbers and BigInts', () => {
      expect(formatClickToCopy('OP-DRV-0042')).toBe('<code>OP-DRV-0042</code>');
      expect(formatClickToCopy(12345)).toBe('<code>12345</code>');
      expect(formatClickToCopy(7594239391n)).toBe('<code>7594239391</code>');
    });

    it('returns empty string for empty or nullish inputs', () => {
      expect(formatClickToCopy('')).toBe('');
      expect(formatClickToCopy(undefined as any)).toBe('');
      expect(formatClickToCopy(null as any)).toBe('');
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

  describe('Link Preview Options', () => {
    it('provides DISABLED_LINK_PREVIEWS constant', () => {
      expect(DISABLED_LINK_PREVIEWS).toEqual({ is_disabled: true });
    });

    it('builds link preview options dynamically', () => {
      expect(buildLinkPreviewOptions(true)).toEqual({ is_disabled: true });
      expect(buildLinkPreviewOptions(false)).toEqual({ is_disabled: false });
    });
  });

  describe('Modal Alerts', () => {
    it('builds modal alert options', () => {
      expect(buildModalAlertOptions('تنبيه هام')).toEqual({
        text: 'تنبيه هام',
        show_alert: true,
      });
    });

    it('invokes answerCallbackQuery with show_alert: true', async () => {
      const ctx = {
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
      };
      await showModalAlert(ctx, 'رسالة تنبيه');
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
        text: 'رسالة تنبيه',
        show_alert: true,
      });
    });

    it('gracefully swallows expired callback query errors in showModalAlert', async () => {
      const ctx = {
        answerCallbackQuery: vi.fn().mockRejectedValue(new Error('QUERY_ID_INVALID')),
      };
      await expect(showModalAlert(ctx, 'فشل')).resolves.not.toThrow();
    });
  });

  describe('Chat Actions & withChatAction', () => {
    it('sendChatActionSafe calls replyWithChatAction and ignores errors', async () => {
      const ctx = {
        replyWithChatAction: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      await expect(sendChatActionSafe(ctx, 'typing')).resolves.not.toThrow();
      expect(ctx.replyWithChatAction).toHaveBeenCalledWith('typing');
    });

    it('withChatAction executes task and returns result', async () => {
      const ctx = {
        replyWithChatAction: vi.fn().mockResolvedValue(true),
      };
      const result = await withChatAction(ctx, 'upload_document', async () => {
        return 'excel_done';
      });
      expect(result).toBe('excel_done');
      expect(ctx.replyWithChatAction).toHaveBeenCalledWith('upload_document');
    });
  });
});
