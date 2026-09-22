import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeArabicText,
  filterWorkers,
  paginateItems,
  buildWorkerPickerKeyboard,
  getWorkerDisplayName,
  formatWorkerPickerLabel,
  type WorkerItem,
} from '../src/index.js';

const PINNED_BASE_TIME = new Date('2026-03-01T12:00:00.000Z');

describe('UniversalWorkerPicker', () => {
  const sampleWorkers: WorkerItem[] = [
    { id: '1', code: '101', name: 'أحمد محمود إبراهيم', siteLocation: 'موقع السويس', jobTitle: 'فني تشغيل' },
    { id: '2', code: '102', name: 'محمد علي السيد', siteLocation: 'موقع السويس', jobTitle: 'سائق لودر' },
    { id: '3', code: '103', name: 'إسلام حسن عثمان', siteLocation: 'موقع الأدبية', jobTitle: 'عامل عادي' },
    { id: '4', code: '104', name: 'علي مصطفى كمال', siteLocation: 'موقع الأدبية', jobTitle: 'فني كهرباء' },
    { id: '5', code: '105', name: 'ياسر عبد الله', siteLocation: 'موقع السويس', jobTitle: 'سائق قلاب' },
  ];

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

  describe('Arabic text normalization', () => {
    it('01: unifies alef variants in arabic text', () => {
      // Arrange
      const alefHamza = 'أحمد';
      const alefKasra = 'إسلام';
      const alefMadda = 'آدم';

      // Act
      const norm1 = normalizeArabicText(alefHamza);
      const norm2 = normalizeArabicText(alefKasra);
      const norm3 = normalizeArabicText(alefMadda);

      // Assert
      expect(norm1).toBe('احمد');
      expect(norm2).toBe('اسلام');
      expect(norm3).toBe('ادم');
    });

    it('02: unifies taa marbuta and yaa variants', () => {
      // Arrange
      const taaMarbuta = 'فاطمة';
      const yaa = 'علي';
      const alefMaksura = 'يسرى';

      // Act
      const norm1 = normalizeArabicText(taaMarbuta);
      const norm2 = normalizeArabicText(yaa);
      const norm3 = normalizeArabicText(alefMaksura);

      // Assert
      expect(norm1).toBe('فاطمه');
      expect(norm2).toBe('علي');
      expect(norm3).toBe('يسري');
    });
  });

  describe('Worker filtering and search', () => {
    it('03: searches by name with diacritics tolerance', () => {
      // Arrange
      const searchOptions = { query: 'احمد' };

      // Act
      const results = filterWorkers(sampleWorkers, searchOptions);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('1');
    });

    it('04: searches by numeric worker code using eastern arabic digits', () => {
      // Arrange
      const searchOptions = { query: '١٠٣' };

      // Act
      const results = filterWorkers(sampleWorkers, searchOptions);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('إسلام حسن عثمان');
    });

    it('05: returns empty array when search query matches no workers', () => {
      // Arrange
      const searchOptions = { query: 'غير موجود إطلاقا' };

      // Act
      const results = filterWorkers(sampleWorkers, searchOptions);

      // Assert
      expect(results).toHaveLength(0);
      expect(results).toEqual([]);
    });

    it('06: silently resolves workers by historical legacy code without showing old code in UI', () => {
      // Arrange
      const modernWorker: WorkerItem = {
        id: '99',
        code: 'FL-DRV-0042',
        aliases: ['101', 'OP-HLP-0015'],
        name: 'أحمد محمود إبراهيم',
        jobTitle: 'سائق لودر',
      };

      // Act
      const resOldCode = filterWorkers([modernWorker], { query: '101' });
      const resSeq = filterWorkers([modernWorker], { query: '0042' });
      const { items, pagination } = paginateItems([modernWorker], 1, 1);
      const kb = buildWorkerPickerKeyboard({ workers: items, pagination });
      const buttonText = kb.inline_keyboard[0]![0]!.text;

      // Assert
      expect(resOldCode).toHaveLength(1);
      expect(resOldCode[0]?.code).toBe('FL-DRV-0042');
      expect(resSeq).toHaveLength(1);
      expect(buttonText).toContain('سائق لودر');
      expect(buttonText).not.toContain('101');
      expect(buttonText).not.toContain('OP-HLP-0015');
    });

    it('07: filters workers by site location and returns empty array for unknown site', () => {
      // Arrange
      const matchedFilter = { siteLocation: 'موقع الأدبية' };
      const unmatchedFilter = { siteLocation: 'موقع غير معروف' };

      // Act
      const matchedResults = filterWorkers(sampleWorkers, matchedFilter);
      const unmatchedResults = filterWorkers(sampleWorkers, unmatchedFilter);

      // Assert
      expect(matchedResults).toHaveLength(2);
      expect(matchedResults[0]?.siteLocation).toBe('موقع الأدبية');
      expect(matchedResults[1]?.siteLocation).toBe('موقع الأدبية');
      expect(unmatchedResults).toHaveLength(0);
      expect(unmatchedResults).toEqual([]);
    });
  });

  describe('In-place pagination', () => {
    it('08: paginates items into correct page slices', () => {
      // Arrange
      const pageSize = 2;

      // Act
      const page1 = paginateItems(sampleWorkers, 1, pageSize);
      const page2 = paginateItems(sampleWorkers, 2, pageSize);
      const page3 = paginateItems(sampleWorkers, 3, pageSize);

      // Assert
      expect(page1.items).toHaveLength(2);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.totalPages).toBe(3);
      expect(page1.pagination.totalItems).toBe(5);

      expect(page2.items).toHaveLength(2);
      expect(page2.items[0]?.id).toBe('3');

      expect(page3.items).toHaveLength(1);
      expect(page3.items[0]?.id).toBe('5');
    });
  });

  describe('Keyboard builder', () => {
    it('09: builds inline keyboard with pagination and custom action buttons', () => {
      // Arrange
      const { items, pagination } = paginateItems(sampleWorkers, 1, 2);

      // Act
      const keyboard = buildWorkerPickerKeyboard({
        workers: items,
        pagination,
        customActionButtons: [{ text: '☕ ضيافة الموقع', callbackData: 'action:hospitality' }],
        allowSearch: true,
      });

      const hasSearch = keyboard.inline_keyboard.some((row) =>
        row.some((btn) => btn.text.includes('بحث'))
      );
      const hasCancel = keyboard.inline_keyboard.some((row) =>
        row.some((btn) => btn.text.includes('إلغاء'))
      );

      // Assert
      expect(keyboard.inline_keyboard.length).toBeGreaterThanOrEqual(4);
      expect(hasSearch).toBe(true);
      expect(hasCancel).toBe(true);
    });

    it('10: strictly displays worker nickname over full name in buttons and labels', () => {
      // Arrange
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

      // Act
      const nameWithNick = getWorkerDisplayName(workerWithNick);
      const nameWithoutNick = getWorkerDisplayName(workerWithoutNick);

      const labelWithNick = formatWorkerPickerLabel(workerWithNick);
      const labelWithoutNick = formatWorkerPickerLabel(workerWithoutNick);
      const labelWithoutJob = formatWorkerPickerLabel(workerWithoutJob);
      const labelSelected = formatWorkerPickerLabel(workerWithNick, true);

      const { items, pagination } = paginateItems([workerWithNick, workerWithoutNick], 1, 2);
      const kb = buildWorkerPickerKeyboard({
        workers: items,
        pagination,
        backCallbackData: 'menu:domain:hr',
        mainMenuCallbackData: 'action:main_menu',
      });

      const btn1 = kb.inline_keyboard[0]![0]!.text;
      const btn2 = kb.inline_keyboard[1]![0]!.text;

      const hasBack = kb.inline_keyboard.some((row) =>
        row.some((btn) => 'callback_data' in btn && btn.text.includes('العودة') && btn.callback_data === 'menu:domain:hr')
      );
      const hasHome = kb.inline_keyboard.some((row) =>
        row.some((btn) => 'callback_data' in btn && btn.text.includes('الرئيسية') && btn.callback_data === 'action:main_menu')
      );

      // Assert
      expect(nameWithNick).toBe('أبو خليل');
      expect(nameWithoutNick).toBe('علي حسن إبراهيم');
      expect(labelWithNick).toBe('🚜 أبو خليل (سائق لودر ومعدات)');
      expect(labelWithoutNick).toBe('🔧 علي حسن إبراهيم (فني ميكانيكا)');
      expect(labelWithoutJob).toBe('👷 إسلام عثمان (OP-LAB-0003)');
      expect(labelSelected).toBe('✅ أبو خليل (سائق لودر ومعدات)');
      expect(btn1).toBe('🚜 أبو خليل (سائق لودر ومعدات)');
      expect(btn2).toBe('🔧 علي حسن إبراهيم (فني ميكانيكا)');
      expect(hasBack).toBe(true);
      expect(hasHome).toBe(true);
    });

    it('11: supports custom formatLabel option for domain-specific badge and score decoration', () => {
      // Arrange
      interface CustomWorker extends WorkerItem {
        badge: string;
        score: number;
      }

      const worker: CustomWorker = {
        id: 'cw-1',
        code: 'DRV-10',
        name: 'صالح رجب',
        nickname: 'صالح رجب',
        jobTitle: 'سائق لودر',
        badge: '🟢',
        score: 95,
      };

      const { items, pagination } = paginateItems([worker], 1, 1);

      // Act
      const kb = buildWorkerPickerKeyboard<CustomWorker>({
        workers: items,
        pagination,
        formatLabel: (w) => `${w.badge} 🚜 ${w.nickname} - ${w.score} نقطة`,
      });
      const buttonText = kb.inline_keyboard[0]![0]!.text;

      // Assert
      expect(buttonText).toBe('🟢 🚜 صالح رجب - 95 نقطة');
      expect(buttonText).not.toContain('OP-LAB');
    });
  });
});
