import { describe, it, expect } from 'vitest';
import {
  normalizeArabicText,
  filterWorkers,
  paginateItems,
  buildWorkerPickerKeyboard,
  type WorkerItem,
} from '../src/index.js';

describe('UniversalWorkerPicker', () => {
  const sampleWorkers: WorkerItem[] = [
    { id: '1', code: '101', name: 'أحمد محمود إبراهيم', siteLocation: 'موقع السويس', jobTitle: 'فني تشغيل' },
    { id: '2', code: '102', name: 'محمد علي السيد', siteLocation: 'موقع السويس', jobTitle: 'سائق لودر' },
    { id: '3', code: '103', name: 'إسلام حسن عثمان', siteLocation: 'موقع الأدبية', jobTitle: 'عامل عادي' },
    { id: '4', code: '104', name: 'علي مصطفى كمال', siteLocation: 'موقع الأدبية', jobTitle: 'فني كهرباء' },
    { id: '5', code: '105', name: 'ياسر عبد الله', siteLocation: 'موقع السويس', jobTitle: 'سائق قلاب' },
  ];

  describe('Arabic text normalization', () => {
    it('unifies alef variants (أ / إ / آ -> ا)', () => {
      expect(normalizeArabicText('أحمد')).toBe('احمد');
      expect(normalizeArabicText('إسلام')).toBe('اسلام');
      expect(normalizeArabicText('آدم')).toBe('ادم');
    });

    it('unifies taa marbuta and yaa', () => {
      expect(normalizeArabicText('فاطمة')).toBe('فاطمه');
      expect(normalizeArabicText('علي')).toBe('علي');
      expect(normalizeArabicText('يسرى')).toBe('يسري');
    });
  });

  describe('Worker filtering & search', () => {
    it('searches by name with diacritics tolerance', () => {
      const results = filterWorkers(sampleWorkers, { query: 'احمد' });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('1');
    });

    it('searches by numeric worker code', () => {
      const results = filterWorkers(sampleWorkers, { query: '١٠٣' }); // Eastern Arabic digits
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('إسلام حسن عثمان');
    });

    it('filters by site location', () => {
      const results = filterWorkers(sampleWorkers, { siteLocation: 'موقع الأدبية' });
      expect(results).toHaveLength(2);
    });
  });

  describe('In-place pagination', () => {
    it('paginates items into correct page slices', () => {
      const { items, pagination } = paginateItems(sampleWorkers, 1, 2);
      expect(items).toHaveLength(2);
      expect(pagination.page).toBe(1);
      expect(pagination.totalPages).toBe(3);
      expect(pagination.totalItems).toBe(5);

      const page2 = paginateItems(sampleWorkers, 2, 2);
      expect(page2.items).toHaveLength(2);
      expect(page2.items[0]?.id).toBe('3');

      const page3 = paginateItems(sampleWorkers, 3, 2);
      expect(page3.items).toHaveLength(1);
      expect(page3.items[0]?.id).toBe('5');
    });
  });

  describe('Keyboard builder', () => {
    it('builds inline keyboard with pagination and custom action buttons', () => {
      const { items, pagination } = paginateItems(sampleWorkers, 1, 2);
      const keyboard = buildWorkerPickerKeyboard({
        workers: items,
        pagination,
        customActionButtons: [{ text: '☕ ضيافة الموقع', callbackData: 'action:hospitality' }],
        allowSearch: true,
      });

      expect(keyboard.inline_keyboard.length).toBeGreaterThanOrEqual(4);
      // Ensure search button exists
      const hasSearch = keyboard.inline_keyboard.some((row) =>
        row.some((btn) => btn.text.includes('بحث'))
      );
      expect(hasSearch).toBe(true);

      // Ensure cancel button exists
      const hasCancel = keyboard.inline_keyboard.some((row) =>
        row.some((btn) => btn.text.includes('إلغاء'))
      );
      expect(hasCancel).toBe(true);
    });
  });
});
