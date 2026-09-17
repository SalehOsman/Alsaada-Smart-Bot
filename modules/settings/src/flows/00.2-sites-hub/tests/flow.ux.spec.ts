import { describe, it, expect } from 'vitest';
import {
  buildSitesListKeyboard,
  buildGovPickerKeyboard,
  buildGeofencePickerKeyboard,
  buildConfirmCodeKeyboard,
  buildSiteLocationPromptKeyboard,
  EGYPTIAN_GOVERNORATES,
  GOV_PAGE_SIZE,
} from '../flow.keyboard.js';

function cbData(btn: unknown): string | undefined {
  return (btn as { callback_data?: string })?.callback_data;
}

describe('Flow 00.2 UX Tests — مصفوفة المشاريع والمواقع الميدانية', () => {
  it('should generate valid inline keyboard with action buttons', () => {
    const kb = buildSitesListKeyboard([]);
    expect(kb).toBeDefined();
    expect(kb.inline_keyboard.length).toBeGreaterThan(0);
  });

  it('should display exactly 27 Egyptian governorates partitioned across 3 pages', () => {
    expect(EGYPTIAN_GOVERNORATES).toHaveLength(27);
    expect(GOV_PAGE_SIZE).toBe(9);

    const collectedGovs: string[] = [];

    for (let page = 1; page <= 3; page++) {
      const kb = buildGovPickerKeyboard(undefined, page);
      // Rows 0, 1, 2 are governorates (3 items each)
      for (let r = 0; r < 3; r++) {
        expect(kb.inline_keyboard[r]).toBeDefined();
        for (const btn of kb.inline_keyboard[r]!) {
          collectedGovs.push(btn.text);
          expect(cbData(btn)).toMatch(/^action:site:add:gov:/);
        }
      }
    }

    expect(collectedGovs).toHaveLength(27);
    expect(new Set(collectedGovs).size).toBe(27);
    expect(collectedGovs).toEqual([...EGYPTIAN_GOVERNORATES]);
  });

  it('should render page 1 with next button, page indicator, and back to code button', () => {
    const kb = buildGovPickerKeyboard(undefined, 1);
    const navRow = kb.inline_keyboard[3]!;
    expect(navRow).toHaveLength(2);
    expect(navRow[0]!.text).toBe('◀️ التالي');
    expect(cbData(navRow[0])).toBe('action:site:add_gov_page:2');
    expect(navRow[1]!.text).toBe('📄 صفحة 1 من 3');
    expect(cbData(navRow[1])).toBe('action:site:gov:noop');

    const bottomRow = kb.inline_keyboard[4]!;
    expect(bottomRow).toHaveLength(2);
    expect(bottomRow[0]!.text).toBe('◀️ السابق');
    expect(cbData(bottomRow[0])).toBe('action:site:add:back_to_code');
    expect(bottomRow[1]!.text).toBe('❌ إلغاء');
    expect(cbData(bottomRow[1])).toBe('action:settings:sites_hub');
  });

  it('should render page 2 with both previous and next buttons', () => {
    const kb = buildGovPickerKeyboard(undefined, 2);
    const navRow = kb.inline_keyboard[3]!;
    expect(navRow).toHaveLength(3);
    expect(navRow[0]!.text).toBe('◀️ التالي');
    expect(cbData(navRow[0])).toBe('action:site:add_gov_page:3');
    expect(navRow[1]!.text).toBe('📄 صفحة 2 من 3');
    expect(cbData(navRow[1])).toBe('action:site:gov:noop');
    expect(navRow[2]!.text).toBe('السابق ▶️');
    expect(cbData(navRow[2])).toBe('action:site:add_gov_page:1');
  });

  it('should render page 3 with previous button, page indicator, and no next button', () => {
    const kb = buildGovPickerKeyboard(undefined, 3);
    const navRow = kb.inline_keyboard[3]!;
    expect(navRow).toHaveLength(2);
    expect(navRow[0]!.text).toBe('📄 صفحة 3 من 3');
    expect(cbData(navRow[0])).toBe('action:site:gov:noop');
    expect(navRow[1]!.text).toBe('السابق ▶️');
    expect(cbData(navRow[1])).toBe('action:site:add_gov_page:2');
  });

  it('should render edit mode with siteCode prefixes and cancel return to site detail', () => {
    const kb = buildGovPickerKeyboard('STE-01', 1);
    const firstGovBtn = kb.inline_keyboard[0]![0]!;
    expect(cbData(firstGovBtn)).toBe('action:site:set_gov:STE-01:القاهرة');

    const navRow = kb.inline_keyboard[3]!;
    expect(cbData(navRow[0])).toBe('action:site:edit_gov_page:STE-01:2');

    const bottomRow = kb.inline_keyboard[4]!;
    expect(bottomRow).toHaveLength(1);
    expect(bottomRow[0]!.text).toBe('❌ إلغاء والعودة');
    expect(cbData(bottomRow[0])).toBe('action:site:view:STE-01');
  });

  it('should configure geofence picker with back button pointing to location in wizard and cancel in edit mode', () => {
    const addKb = buildGeofencePickerKeyboard();
    const addBottomRow = addKb.inline_keyboard[addKb.inline_keyboard.length - 1]!;
    expect(addBottomRow[0]!.text).toBe('◀️ السابق');
    expect(cbData(addBottomRow[0])).toBe('action:site:add:back_to_location');
    expect(addBottomRow[1]!.text).toBe('❌ إلغاء');
    expect(cbData(addBottomRow[1])).toBe('action:settings:sites_hub');

    const editKb = buildGeofencePickerKeyboard('STE-01');
    const editBottomRow = editKb.inline_keyboard[editKb.inline_keyboard.length - 1]!;
    expect(editBottomRow).toHaveLength(1);
    expect(editBottomRow[0]!.text).toBe('❌ إلغاء والعودة');
    expect(cbData(editBottomRow[0])).toBe('action:site:view:STE-01');
  });

  it('should configure location prompt keyboard with skip, back to gov, and cancel buttons', () => {
    const kb = buildSiteLocationPromptKeyboard();
    expect(kb.inline_keyboard).toHaveLength(2);
    expect(kb.inline_keyboard[0]![0]!.text).toBe('⏭️ تخطي (بدون إحداثيات الآن)');
    expect(cbData(kb.inline_keyboard[0]![0])).toBe('action:site:add:skip_location');
    expect(kb.inline_keyboard[1]![0]!.text).toBe('◀️ السابق');
    expect(cbData(kb.inline_keyboard[1]![0])).toBe('action:site:add:back_to_gov');
    expect(kb.inline_keyboard[1]![1]!.text).toBe('❌ إلغاء');
    expect(cbData(kb.inline_keyboard[1]![1])).toBe('action:settings:sites_hub');
  });

  it('should build confirm code keyboard correctly with back and cancel buttons', () => {
    const kb = buildConfirmCodeKeyboard('STE-99');
    expect(kb.inline_keyboard[0]![0]!.text).toBe('✅ اعتماد الكود المقترح (STE-99)');
    expect(cbData(kb.inline_keyboard[0]![0])).toBe('action:site:confirm_code:STE-99');
    expect(kb.inline_keyboard[1]![0]!.text).toBe('◀️ السابق');
    expect(cbData(kb.inline_keyboard[1]![0])).toBe('action:site:add:back_to_name');
    expect(kb.inline_keyboard[1]![1]!.text).toBe('❌ إلغاء');
  });
});
