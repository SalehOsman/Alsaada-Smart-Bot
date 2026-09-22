import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPurchaseSuggestionsKeyboard, DEFAULT_IN_KIND_SUGGESTIONS } from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('In-Kind Purchase Suggestions Picker', () => {
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

  it('1. builds suggestions keyboard with default common site items and manual input button', () => {
    // Arrange
    const options = {
      backCallbackData: 'action:back',
    };

    // Act
    const kb = buildPurchaseSuggestionsKeyboard(options);

    // Assert
    // 6 default suggestions (2 per row = 3 rows) + 1 manual row + 1 nav row = 5 rows
    expect(kb.inline_keyboard.length).toBe(5);

    const firstRow = kb.inline_keyboard[0]!;
    expect(firstRow[0]!.text).toContain('معلبات وإعاشة');
    expect(firstRow[1]!.text).toContain('حذاء أمان / سيفتي');

    const manualRow = kb.inline_keyboard[3]!;
    expect(manualRow[0]!.text).toContain('كتابة بيان مخصص يدوياً');

    const navRow = kb.inline_keyboard[4]!;
    expect(navRow.some((b) => b.text.includes('السابق'))).toBe(true);
    expect(navRow.some((b) => b.text.includes('إلغاء'))).toBe(true);
  });

  it('2. renders custom suggestions and custom callback prefixes', () => {
    // Arrange
    const customItems = ['خوذة سلامة', 'سترة فسفورية'];
    const options = {
      suggestions: customItems,
      callbackPrefix: 'custom_pref:',
      cancelCallbackData: 'action:exit',
    };

    // Act
    const kb = buildPurchaseSuggestionsKeyboard(options);

    // Assert
    expect(kb.inline_keyboard.length).toBe(3); // 1 suggestion row + 1 manual + 1 nav
    const itemRow = kb.inline_keyboard[0]!;
    expect(itemRow[0]!.text).toBe('خوذة سلامة');
    expect((itemRow[0] as any).callback_data).toBe(`custom_pref:${encodeURIComponent('خوذة سلامة')}`);
    expect(itemRow[1]!.text).toBe('سترة فسفورية');
    expect((itemRow[1] as any).callback_data).toBe(`custom_pref:${encodeURIComponent('سترة فسفورية')}`);
  });

  it('3. excludes manual input row when allowManualInput is false', () => {
    // Arrange
    const options = {
      allowManualInput: false,
      backCallbackData: 'action:step1',
    };

    // Act
    const kb = buildPurchaseSuggestionsKeyboard(options);

    // Assert
    expect(kb.inline_keyboard.length).toBe(4); // 3 suggestion rows + 1 nav row (no manual row)
    const allButtons = kb.inline_keyboard.flat();
    const hasManual = allButtons.some((b) => b.text.includes('كتابة بيان'));
    expect(hasManual).toBe(false);
  });

  it('4. excludes back button when backCallbackData is omitted', () => {
    // Arrange
    const options = {
      allowManualInput: false,
    };

    // Act
    const kb = buildPurchaseSuggestionsKeyboard(options);

    // Assert
    const lastRow = kb.inline_keyboard[kb.inline_keyboard.length - 1]!;
    expect(lastRow.length).toBe(1);
    expect(lastRow[0]!.text).toContain('إلغاء');
    expect(lastRow.some((b) => b.text.includes('السابق'))).toBe(false);
  });
});
