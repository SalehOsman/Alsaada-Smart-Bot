import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Telegram UX Formatters & Components', () => {
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

  describe('formatBreadcrumbs', () => {
    it('1. formats multi-segment breadcrumbs with ❯ separator', () => {
      // Arrange
      const segments = ['⚙️ الإعدادات', '🏢 الكيان المؤسسي', '🏗️ مصفوفة المشاريع'];

      // Act
      const result = formatBreadcrumbs(segments);

      // Assert
      expect(result).toBe('📍 *المسار:* ⚙️ الإعدادات ❯ 🏢 الكيان المؤسسي ❯ 🏗️ مصفوفة المشاريع\n\n');
      expect(result).toContain('❯');
    });

    it('2. filters out empty or whitespace-only segments', () => {
      // Arrange
      const segments = ['⚙️ الإعدادات', '   ', '', '👤 ملفي الشخصي'];

      // Act
      const result = formatBreadcrumbs(segments);

      // Assert
      expect(result).toBe('📍 *المسار:* ⚙️ الإعدادات ❯ 👤 ملفي الشخصي\n\n');
      expect(result).not.toContain('❯  ❯');
    });

    it('3. returns empty string when given empty array', () => {
      // Arrange
      const emptySegments: string[] = [];

      // Act
      const result = formatBreadcrumbs(emptySegments);

      // Assert
      expect(result).toBe('');
      expect(result.length).toBe(0);
    });
  });

  describe('formatSpoiler', () => {
    it('4. wraps text inside <tg-spoiler> tags by default', () => {
      // Arrange
      const text = '5000 ج.م';

      // Act
      const result = formatSpoiler(text);

      // Assert
      expect(result).toBe('<tg-spoiler>5000 ج.م</tg-spoiler>');
      expect(result).toContain('5000');
    });

    it('5. wraps text inside || tags when mode is markdown', () => {
      // Arrange
      const text = '5000 ج.م';

      // Act
      const result = formatSpoiler(text, 'markdown');

      // Assert
      expect(result).toBe('||5000 ج.م||');
      expect(result).not.toContain('<tg-spoiler>');
    });

    it('6. returns empty string for null, empty or whitespace-only inputs', () => {
      // Arrange
      const emptyText = '';
      const spaceText = '   ';

      // Act
      const resEmpty = formatSpoiler(emptyText);
      const resSpace = formatSpoiler(spaceText);

      // Assert
      expect(resEmpty).toBe('');
      expect(resSpace).toBe('');
      expect(resEmpty).toHaveLength(0);
    });
  });

  describe('formatExpandableQuote', () => {
    it('7. wraps multi-line text inside <blockquote expandable> tags by default', () => {
      // Arrange
      const notes = 'ملاحظة طبية:\nيعاني من حساسية صدرية ويمنع من العمل في مناطق الأتربة';

      // Act
      const result = formatExpandableQuote(notes);

      // Assert
      expect(result).toBe(
        '<blockquote expandable>ملاحظة طبية:\nيعاني من حساسية صدرية ويمنع من العمل في مناطق الأتربة</blockquote>'
      );
      expect(result).toContain('expandable');
    });

    it('8. wraps text inside **> tags when mode is markdown', () => {
      // Arrange
      const notes = 'سطر أول\nسطر ثان';

      // Act
      const result = formatExpandableQuote(notes, 'markdown');

      // Assert
      expect(result).toBe('**>سطر أول\n>سطر ثان**');
      expect(result).not.toContain('<blockquote');
    });

    it('9. returns empty string for empty input', () => {
      // Arrange
      const emptyNotes = '';

      // Act
      const result = formatExpandableQuote(emptyNotes);

      // Assert
      expect(result).toBe('');
      expect(result).toHaveLength(0);
    });
  });

  describe('formatMonospace & formatClickToCopy', () => {
    it('10. wraps text in markdown backticks by default for 1-tap copying without raw tags', () => {
      // Arrange
      const rawText = '29901011234567';

      // Act
      const mdResult = formatMonospace(rawText);
      const htmlResult = formatMonospace(rawText, 'html');

      // Assert
      expect(mdResult).toBe('`29901011234567`');
      expect(htmlResult).toBe('<code>29901011234567</code>');
      expect(mdResult).not.toContain('<code>');
    });

    it('11. formatClickToCopy supports strings, numbers and BigInts with markdown default', () => {
      // Arrange
      const strVal = 'OP-DRV-0042';
      const numVal = 12345;
      const bigIntVal = 7594239391n;

      // Act
      const resStr = formatClickToCopy(strVal);
      const resNum = formatClickToCopy(numVal);
      const resBigInt = formatClickToCopy(bigIntVal);
      const resHtml = formatClickToCopy(bigIntVal, 'html');

      // Assert
      expect(resStr).toBe('`OP-DRV-0042`');
      expect(resNum).toBe('`12345`');
      expect(resBigInt).toBe('`7594239391`');
      expect(resHtml).toBe('<code>7594239391</code>');
      expect(resStr).not.toBe(resNum);
    });

    it('12. returns empty string for empty or nullish inputs', () => {
      // Arrange
      const emptyVal = '';
      const undefVal = undefined as any;
      const nullVal = null as any;

      // Act
      const resEmpty = formatClickToCopy(emptyVal);
      const resUndef = formatClickToCopy(undefVal);
      const resNull = formatClickToCopy(nullVal);

      // Assert
      expect(resEmpty).toBe('');
      expect(resUndef).toBe('');
      expect(resNull).toBe('');
    });
  });

  describe('buildCopyTextButton', () => {
    it('13. constructs a valid Telegram Bot API 7.10+ copy_text inline button', () => {
      // Arrange
      const label = '📋 نسخ إنستاباي';
      const textToCopy = 'emp@instapay';

      // Act
      const button = buildCopyTextButton(label, textToCopy);

      // Assert
      expect(button).toEqual({
        text: '📋 نسخ إنستاباي',
        copy_text: {
          text: 'emp@instapay',
        },
      });
      expect(button.text).toContain('نسخ');
    });
  });

  describe('buildInputFieldPlaceholder', () => {
    it('14. constructs input_field_placeholder object', () => {
      // Arrange
      const placeholderText = 'اكتب المبلغ بالأرقام...';

      // Act
      const res = buildInputFieldPlaceholder(placeholderText);

      // Assert
      expect(res).toEqual({
        input_field_placeholder: 'اكتب المبلغ بالأرقام...',
      });
      expect(res.input_field_placeholder).toContain('المبلغ');
    });
  });

  describe('Link Preview Options', () => {
    it('15. provides DISABLED_LINK_PREVIEWS constant', () => {
      // Arrange
      const expectedDisabled = true;

      // Act
      const constant = DISABLED_LINK_PREVIEWS;

      // Assert
      expect(constant).toEqual({ is_disabled: expectedDisabled });
      expect(constant.is_disabled).toBe(true);
    });

    it('16. builds link preview options dynamically', () => {
      // Arrange
      const optTrue = true;
      const optFalse = false;

      // Act
      const resDisabled = buildLinkPreviewOptions(optTrue);
      const resEnabled = buildLinkPreviewOptions(optFalse);

      // Assert
      expect(resDisabled).toEqual({ is_disabled: true });
      expect(resEnabled).toEqual({ is_disabled: false });
      expect(resDisabled.is_disabled).not.toBe(resEnabled.is_disabled);
    });
  });

  describe('Modal Alerts', () => {
    it('17. builds modal alert options and invokes answerCallbackQuery', async () => {
      // Arrange
      const alertText = 'تنبيه هام';
      const ctx = {
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
      };

      // Act
      const options = buildModalAlertOptions(alertText);
      await showModalAlert(ctx, 'رسالة تنبيه');

      // Assert
      expect(options).toEqual({
        text: 'تنبيه هام',
        show_alert: true,
      });
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
        text: 'رسالة تنبيه',
        show_alert: true,
      });
    });

    it('18. gracefully swallows expired callback query errors in showModalAlert', async () => {
      // Arrange
      const ctx = {
        answerCallbackQuery: vi.fn().mockRejectedValue(new Error('QUERY_ID_INVALID')),
      };

      // Act
      const action = () => showModalAlert(ctx, 'فشل');

      // Assert
      await expect(action()).resolves.not.toThrow();
      expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('Chat Actions & withChatAction', () => {
    it('19. executes task with chat action, cleans up timer, and ignores fallback errors', async () => {
      // Arrange
      const ctxSafe = {
        replyWithChatAction: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      const ctxSuccess = {
        replyWithChatAction: vi.fn().mockResolvedValue(true),
      };
      const ctxEmpty = {};

      // Act
      const safeAction = () => sendChatActionSafe(ctxSafe, 'typing');
      const resultSuccess = await withChatAction(ctxSuccess, 'upload_document', async () => 'excel_done');
      const resultEmpty = await withChatAction(ctxEmpty as any, 'typing', async () => 'ok');

      // Assert
      await expect(safeAction()).resolves.not.toThrow();
      expect(ctxSafe.replyWithChatAction).toHaveBeenCalledWith('typing');
      expect(resultSuccess).toBe('excel_done');
      expect(ctxSuccess.replyWithChatAction).toHaveBeenCalledWith('upload_document');
      expect(resultEmpty).toBe('ok');
    });
  });
});
