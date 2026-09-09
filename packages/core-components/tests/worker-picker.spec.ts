import { describe, it, expect } from 'vitest';
import {
  normalizeArabicText,
  filterWorkers,
  paginateItems,
  buildWorkerPickerKeyboard,
  getWorkerDisplayName,
  formatWorkerPickerLabel,
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

    it('silently resolves workers by historical legacy code without showing old code in UI', () => {
      const modernWorker: WorkerItem = {
        id: '99',
        code: 'FL-DRV-0042',
        aliases: ['101', 'OP-HLP-0015'],
        name: 'أحمد محمود إبراهيم',
        jobTitle: 'سائق لودر',
      };

      // 1. Search by legacy code "101"
      const resOldCode = filterWorkers([modernWorker], { query: '101' });
      expect(resOldCode).toHaveLength(1);
      expect(resOldCode[0]?.code).toBe('FL-DRV-0042');

      // 2. Search by sequence number "0042"
      const resSeq = filterWorkers([modernWorker], { query: '0042' });
      expect(resSeq).toHaveLength(1);

      // 3. Verify that UI keyboard displays ONLY current code and no old codes
      const { items, pagination } = paginateItems([modernWorker], 1, 1);
      const kb = buildWorkerPickerKeyboard({ workers: items, pagination });
      const buttonText = kb.inline_keyboard[0]![0]!.text;

      expect(buttonText).toContain('سائق لودر');
      expect(buttonText).not.toContain('101');
      expect(buttonText).not.toContain('OP-HLP-0015');
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

    it('strictly displays worker nickname over full name in buttons and labels', () => {
      const workerWithNick: WorkerItem = {
        id: 'w-1',
        code: 'OP-DRV-0001',
        name: 'إبراهيم سيد محمد عطا الله',
        nickname: 'أبو خليل',
        jobTitle: 'سائق لودر ومعدات',
      };

      const workerWithoutNick: WorkerItem = {
        id: 'w-2',
        code: 'OP-DRV-0002',
        name: 'علي حسن إبراهيم',
        jobTitle: 'فني ميكانيكا',
      };

      const workerWithoutJob: WorkerItem = {
        id: 'w-3',
        code: 'OP-LAB-0003',
        name: 'إسلام عثمان',
      };

      // 1. getWorkerDisplayName priority
      expect(getWorkerDisplayName(workerWithNick)).toBe('أبو خليل');
      expect(getWorkerDisplayName(workerWithoutNick)).toBe('علي حسن إبراهيم');

      // 2. formatWorkerPickerLabel output (job icon + nickname + job title)
      expect(formatWorkerPickerLabel(workerWithNick)).toBe('🚜 أبو خليل (سائق لودر ومعدات)');
      expect(formatWorkerPickerLabel(workerWithoutNick)).toBe('🔧 علي حسن إبراهيم (فني ميكانيكا)');
      expect(formatWorkerPickerLabel(workerWithoutJob)).toBe('👷 إسلام عثمان (OP-LAB-0003)');
      expect(formatWorkerPickerLabel(workerWithNick, true)).toBe('✅ أبو خليل (سائق لودر ومعدات)');

      // 3. buildWorkerPickerKeyboard button text
      const { items, pagination } = paginateItems([workerWithNick, workerWithoutNick], 1, 2);
      const kb = buildWorkerPickerKeyboard({
        workers: items,
        pagination,
        backCallbackData: 'menu:domain:hr',
        mainMenuCallbackData: 'action:main_menu',
      });

      const btn1 = kb.inline_keyboard[0]![0]!.text;
      const btn2 = kb.inline_keyboard[1]![0]!.text;

      expect(btn1).toBe('🚜 أبو خليل (سائق لودر ومعدات)');
      expect(btn2).toBe('🔧 علي حسن إبراهيم (فني ميكانيكا)');

      // 4. Verify navigation buttons
      const hasBack = kb.inline_keyboard.some((row) =>
        row.some((btn) => 'callback_data' in btn && btn.text.includes('العودة') && btn.callback_data === 'menu:domain:hr')
      );
      const hasHome = kb.inline_keyboard.some((row) =>
        row.some((btn) => 'callback_data' in btn && btn.text.includes('الرئيسية') && btn.callback_data === 'action:main_menu')
      );
      expect(hasBack).toBe(true);
      expect(hasHome).toBe(true);
    });
  });
});

