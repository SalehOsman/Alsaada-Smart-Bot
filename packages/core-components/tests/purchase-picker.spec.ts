import { describe, it, expect } from 'vitest';
import { buildPurchaseSuggestionsKeyboard } from '../src/index.js';

describe('In-Kind Purchase Suggestions Picker', () => {
  it('builds suggestions keyboard with default common site items and manual input button', () => {
    const kb = buildPurchaseSuggestionsKeyboard({
      backCallbackData: 'action:back',
    });

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
});
