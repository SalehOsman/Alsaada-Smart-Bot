import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildSitesListKeyboard,
  buildGovPickerKeyboard,
  buildGeofencePickerKeyboard,
  buildConfirmCodeKeyboard,
  buildSiteLocationPromptKeyboard,
  EGYPTIAN_GOVERNORATES,
  GOV_PAGE_SIZE,
} from '../flow.keyboard.js';
import type { SiteDto } from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

function cbData(btn: unknown): string | undefined {
  return (btn as { callback_data?: string })?.callback_data;
}

describe('Flow 00.2 UX Tests — مصفوفة المشاريع والمواقع الميدانية', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates valid inline keyboard with action buttons for empty sites list', () => {
    // Arrange
    const sites: SiteDto[] = [];

    // Act
    const kb = buildSitesListKeyboard(sites);

    // Assert
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
  });

  it('displays exactly 27 Egyptian governorates partitioned across 3 pages', () => {
    // Arrange
    const expectedGovCount = 27;
    const expectedPageSize = 9;
    const collectedGovs: string[] = [];

    // Act
    for (let page = 1; page <= 3; page++) {
      const kb = buildGovPickerKeyboard(undefined, page);
      for (let r = 0; r < 3; r++) {
        for (const btn of kb.inline_keyboard[r]!) {
          collectedGovs.push(btn.text);
        }
      }
    }

    // Assert
    expect(EGYPTIAN_GOVERNORATES).toHaveLength(expectedGovCount);
    expect(GOV_PAGE_SIZE).toBe(expectedPageSize);
    expect(collectedGovs).toHaveLength(expectedGovCount);
    expect(new Set(collectedGovs).size).toBe(expectedGovCount);
    expect(collectedGovs).toEqual([...EGYPTIAN_GOVERNORATES]);
  });

  it('renders page 1 with next button, page indicator, and back to code button', () => {
    // Arrange
    const targetPage = 1;

    // Act
    const kb = buildGovPickerKeyboard(undefined, targetPage);

    // Assert
    const navRow = kb.inline_keyboard[3]!;
    expect(navRow).toHaveLength(2);
    expect(navRow[0]!.text).toBe('◀️ التالي');
    expect(cbData(navRow[0])).toBe('action:site:add_gov_page:2');
    expect(navRow[1]!.text).toBe('📄 صفحة 1 من 3');
    expect(cbData(navRow[1])).toBe('action:site:gov:noop');
    expect(navRow.some((b) => b.text.includes('السابق ▶️'))).toBe(false);

    const bottomRow = kb.inline_keyboard[4]!;
    expect(bottomRow).toHaveLength(2);
    expect(bottomRow[0]!.text).toBe('◀️ السابق');
    expect(cbData(bottomRow[0])).toBe('action:site:add:back_to_code');
    expect(bottomRow[1]!.text).toBe('❌ إلغاء');
    expect(cbData(bottomRow[1])).toBe('action:settings:sites_hub');
  });

  it('renders page 2 with both previous and next buttons', () => {
    // Arrange
    const targetPage = 2;

    // Act
    const kb = buildGovPickerKeyboard(undefined, targetPage);

    // Assert
    const navRow = kb.inline_keyboard[3]!;
    expect(navRow).toHaveLength(3);
    expect(navRow[0]!.text).toBe('◀️ التالي');
    expect(cbData(navRow[0])).toBe('action:site:add_gov_page:3');
    expect(navRow[1]!.text).toBe('📄 صفحة 2 من 3');
    expect(cbData(navRow[1])).toBe('action:site:gov:noop');
    expect(navRow[2]!.text).toBe('السابق ▶️');
    expect(cbData(navRow[2])).toBe('action:site:add_gov_page:1');
  });

  it('renders page 3 with previous button, page indicator, and no next button', () => {
    // Arrange
    const targetPage = 3;

    // Act
    const kb = buildGovPickerKeyboard(undefined, targetPage);

    // Assert
    const navRow = kb.inline_keyboard[3]!;
    expect(navRow).toHaveLength(2);
    expect(navRow[0]!.text).toBe('📄 صفحة 3 من 3');
    expect(cbData(navRow[0])).toBe('action:site:gov:noop');
    expect(navRow[1]!.text).toBe('السابق ▶️');
    expect(cbData(navRow[1])).toBe('action:site:add_gov_page:2');
  });

  it('renders edit mode with siteCode prefixes and cancel return to site detail', () => {
    // Arrange
    const siteCode = 'STE-01';

    // Act
    const kb = buildGovPickerKeyboard(siteCode, 1);

    // Assert
    const firstGovBtn = kb.inline_keyboard[0]![0]!;
    expect(cbData(firstGovBtn)).toBe('action:site:set_gov:STE-01:القاهرة');

    const navRow = kb.inline_keyboard[3]!;
    expect(cbData(navRow[0])).toBe('action:site:edit_gov_page:STE-01:2');

    const bottomRow = kb.inline_keyboard[4]!;
    expect(bottomRow).toHaveLength(1);
    expect(bottomRow[0]!.text).toBe('❌ إلغاء والعودة');
    expect(cbData(bottomRow[0])).toBe('action:site:view:STE-01');
  });

  it('configures geofence picker with back button pointing to location in wizard and cancel in edit mode', () => {
    // Arrange
    const targetCode = 'STE-01';

    // Act
    const addKb = buildGeofencePickerKeyboard();
    const editKb = buildGeofencePickerKeyboard(targetCode);

    // Assert
    const addBottomRow = addKb.inline_keyboard[addKb.inline_keyboard.length - 1]!;
    expect(addBottomRow[0]!.text).toBe('◀️ السابق');
    expect(cbData(addBottomRow[0])).toBe('action:site:add:back_to_location');
    expect(addBottomRow[1]!.text).toBe('❌ إلغاء');
    expect(cbData(addBottomRow[1])).toBe('action:settings:sites_hub');

    const editBottomRow = editKb.inline_keyboard[editKb.inline_keyboard.length - 1]!;
    expect(editBottomRow).toHaveLength(1);
    expect(editBottomRow[0]!.text).toBe('❌ إلغاء والعودة');
    expect(cbData(editBottomRow[0])).toBe('action:site:view:STE-01');
  });

  it('configures location prompt keyboard with skip, back to gov, and cancel buttons', () => {
    // Arrange
    const expectedSkipAction = 'action:site:add:skip_location';

    // Act
    const kb = buildSiteLocationPromptKeyboard();

    // Assert
    expect(kb.inline_keyboard).toHaveLength(2);
    expect(kb.inline_keyboard[0]![0]!.text).toBe('⏭️ تخطي (بدون إحداثيات الآن)');
    expect(cbData(kb.inline_keyboard[0]![0])).toBe(expectedSkipAction);
    expect(kb.inline_keyboard[1]![0]!.text).toBe('◀️ السابق');
    expect(cbData(kb.inline_keyboard[1]![0])).toBe('action:site:add:back_to_gov');
    expect(kb.inline_keyboard[1]![1]!.text).toBe('❌ إلغاء');
    expect(cbData(kb.inline_keyboard[1]![1])).toBe('action:settings:sites_hub');
  });

  it('builds confirm code keyboard correctly with back and cancel buttons', () => {
    // Arrange
    const suggestedCode = 'STE-99';

    // Act
    const kb = buildConfirmCodeKeyboard(suggestedCode);

    // Assert
    expect(kb.inline_keyboard[0]![0]!.text).toBe('✅ اعتماد الكود المقترح (STE-99)');
    expect(cbData(kb.inline_keyboard[0]![0])).toBe('action:site:confirm_code:STE-99');
    expect(kb.inline_keyboard[1]![0]!.text).toBe('◀️ السابق');
    expect(cbData(kb.inline_keyboard[1]![0])).toBe('action:site:add:back_to_name');
    expect(kb.inline_keyboard[1]![1]!.text).toBe('❌ إلغاء');
  });
});
