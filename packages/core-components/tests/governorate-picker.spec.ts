import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getGovernoratesList,
  buildGovernoratePickerKeyboard,
  DEFAULT_GOV_PAGE_SIZE,
} from '../src/governorate-picker/index.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

function cbData(btn: unknown): string | undefined {
  return (btn as { callback_data?: string })?.callback_data;
}

describe('Universal Governorate Picker', () => {
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

  it('1. returns exactly 27 Egyptian governorates excluding foreign birth (code 88)', () => {
    // Arrange & Act
    // Act
    const list = getGovernoratesList();

    // Assert
    expect(list).toHaveLength(27);

    // Code 88 should not exist
    const has88 = list.some((g) => g.code === '88');
    expect(has88).toBe(false);

    // Key governorates exist
    const codes = list.map((g) => g.code);
    expect(codes).toContain('01'); // Cairo
    expect(codes).toContain('02'); // Alexandria
    expect(codes).toContain('04'); // Suez
    expect(codes).toContain('21'); // Giza
  });

  it('2. partitions 27 governorates into 3 pages of 9 items (3x3 grid)', () => {
    // Arrange & Act & Assert
    // Assert
    expect(DEFAULT_GOV_PAGE_SIZE).toBe(9);

    for (let page = 1; page <= 3; page++) {
      // Act
      const kb = buildGovernoratePickerKeyboard({ page });

      // Assert
      // Rows 0, 1, 2 must have 3 buttons each (3x3 grid = 9 items)
      expect(kb.inline_keyboard[0]).toHaveLength(3);
      expect(kb.inline_keyboard[1]).toHaveLength(3);
      expect(kb.inline_keyboard[2]).toHaveLength(3);
    }
  });

  it('3. formats callback data with Arabic name by default', () => {
    // Arrange
    const options = {
      page: 1,
      actionPrefix: 'action:site:add:gov',
    };

    // Act
    const kb = buildGovernoratePickerKeyboard(options);
    const firstButton = kb.inline_keyboard[0]![0]!;

    // Assert
    expect(firstButton.text).toBe('القاهرة');
    expect(cbData(firstButton)).toBe('action:site:add:gov:القاهرة');
  });

  it('4. formats callback data with code when valueType is "code"', () => {
    // Arrange
    const options = {
      page: 1,
      actionPrefix: 'action:worker:gov',
      valueType: 'code' as const,
    };

    // Act
    const kb = buildGovernoratePickerKeyboard(options);
    const firstButton = kb.inline_keyboard[0]![0]!;

    // Assert
    expect(firstButton.text).toBe('القاهرة');
    expect(cbData(firstButton)).toBe('action:worker:gov:01');
  });

  it('5. renders RTL navigation row correctly across pages', () => {
    // Arrange
    const pagePrefix = 'action:gov_page';

    // Act
    // Page 1: next button on left, page indicator on right
    const kb1 = buildGovernoratePickerKeyboard({
      page: 1,
      pagePrefix,
    });
    const nav1 = kb1.inline_keyboard[3]!;

    // Page 2: next button on left, page indicator center, previous button on right
    const kb2 = buildGovernoratePickerKeyboard({
      page: 2,
      pagePrefix,
    });
    const nav2 = kb2.inline_keyboard[3]!;

    // Page 3: page indicator on left, previous button on right
    const kb3 = buildGovernoratePickerKeyboard({
      page: 3,
      pagePrefix,
    });
    const nav3 = kb3.inline_keyboard[3]!;

    // Assert
    expect(nav1).toHaveLength(2);
    expect(nav1[0]!.text).toBe('◀️ التالي');
    expect(cbData(nav1[0])).toBe('action:gov_page:2');
    expect(nav1[1]!.text).toBe('📄 صفحة 1 من 3');

    expect(nav2).toHaveLength(3);
    expect(nav2[0]!.text).toBe('◀️ التالي');
    expect(cbData(nav2[0])).toBe('action:gov_page:3');
    expect(nav2[1]!.text).toBe('📄 صفحة 2 من 3');
    expect(nav2[2]!.text).toBe('السابق ▶️');
    expect(cbData(nav2[2])).toBe('action:gov_page:1');

    expect(nav3).toHaveLength(2);
    expect(nav3[0]!.text).toBe('📄 صفحة 3 من 3');
    expect(nav3[1]!.text).toBe('السابق ▶️');
    expect(cbData(nav3[1])).toBe('action:gov_page:2');
  });

  it('6. renders control row with back and cancel buttons', () => {
    // Arrange
    const options = {
      page: 1,
      backCallbackData: 'action:site:add:back_to_code',
      cancelCallbackData: 'action:settings:sites_hub',
    };

    // Act
    const kb = buildGovernoratePickerKeyboard(options);
    const controlRow = kb.inline_keyboard[4]!;

    // Assert
    expect(controlRow).toHaveLength(2);
    expect(controlRow[0]!.text).toBe('◀️ السابق');
    expect(cbData(controlRow[0])).toBe('action:site:add:back_to_code');
    expect(controlRow[1]!.text).toBe('❌ إلغاء');
    expect(cbData(controlRow[1])).toBe('action:settings:sites_hub');
  });

  it('7. renders custom cancel text when provided', () => {
    // Arrange
    const options = {
      page: 1,
      cancelCallbackData: 'action:site:view:STE-01',
      cancelText: '❌ إلغاء والعودة',
    };

    // Act
    const kb = buildGovernoratePickerKeyboard(options);
    const controlRow = kb.inline_keyboard[4]!;

    // Assert
    expect(controlRow).toHaveLength(1);
    expect(controlRow[0]!.text).toBe('❌ إلغاء والعودة');
    expect(cbData(controlRow[0])).toBe('action:site:view:STE-01');
  });
});
