import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractFirstTwoNames, parseFlexibleDate } from '@alsaada/regional-engine';
import { workerService, setWorkforcePrisma } from '@alsaada/workforce';
import { prisma } from '../src/db.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

vi.mock('../src/db.js', () => {
  const mockPrisma: any = {
    worker: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'mock-worker-id',
          code: data.code,
          name: data.name,
          nickname: data.nickname,
          aliases: data.aliases,
          site: { name: 'الموقع الرئيسي' },
        })
      ),
      count: vi.fn().mockResolvedValue(0),
    },
    jobTitle: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'job-1',
        code: 'DRV',
        name: 'سائق لودر ومعدات',
        baseSalary: 7000,
        additionalSalary: 1500,
        department: { code: 'OP', name: 'التشغيل' },
      }),
    },
    site: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'site-1',
        name: 'محجر الفوسفات',
      }),
    },
    $transaction: vi.fn().mockImplementation((fn) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

vi.mock('../src/services/fast-cache.service.js', () => ({
  fastCache: {
    invalidate: vi.fn().mockResolvedValue(undefined),
    rememberSWR: vi.fn().mockImplementation((_k, _t, fetcher) => fetcher()),
  },
}));

describe('Worker Full 19-Step Wizard & Compound Nickname Engine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    setWorkforcePrisma(prisma);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Compound Name & Auto-Nickname Engine', () => {
    it('correctly handles compound prefix such as Abd-Allah', () => {
      // Arrange
      const fullName = 'عبد الله محمد محمود خليل';

      // Act
      const nick = extractFirstTwoNames(fullName);

      // Assert
      expect(nick).toBe('عبد الله محمد');
      expect(nick).not.toBe('عبد الله');
    });

    it('correctly handles compound suffix such as Nour-el-Din', () => {
      // Arrange
      const fullName = 'أحمد نور الدين علي إبراهيم';

      // Act
      const nick = extractFirstTwoNames(fullName);

      // Assert
      expect(nick).toBe('أحمد نور الدين');
      expect(nick).not.toBe('أحمد نور');
    });

    it('correctly handles standard two names', () => {
      // Arrange
      const fullName = 'محمود حسن علي سالم';

      // Act
      const nick = extractFirstTwoNames(fullName);

      // Assert
      expect(nick).toBe('محمود حسن');
      expect(nick).not.toBe('محمود');
    });

    it('handles Abu and Umm prefixes cleanly', () => {
      // Arrange
      const fullName = 'أبو بكر سالم محمد';

      // Act
      const nick = extractFirstTwoNames(fullName);

      // Assert
      expect(nick).toBe('أبو بكر سالم');
      expect(nick).not.toBe('أبو بكر');
    });
  });

  describe('Worker Service Registration with Legacy Fields', () => {
    it('persists all legacy fields and adds nickname to aliases', async () => {
      // Arrange
      const newWorkerData = {
        name: 'عبد الرحمن علي محمود السيد',
        nickname: 'عبد الرحمن علي',
        legacyCode: '106',
        idType: 'NATIONAL_ID' as const,
        idNumber: '29205150101234',
        nationality: 'مصر',
        birthDate: new Date('1992-05-15T00:00:00.000Z'),
        gender: 'MALE' as const,
        phone: '01012345678',
        emergencyPhone: '01298765432',
        drivingLicense: 'مهنية درجة أولى',
        militaryStatus: 'أدى الخدمة العسكرية (قدوة حسنة)',
        maritalStatus: 'متزوج ويعول',
        previousInsuranceStatus: 'مؤمن عليه بجهة سابقة',
        idCardFrontPath: 'file_front_123',
        idCardBackPath: 'file_back_456',
        jobTitleId: 'job-1',
        siteId: 'site-1',
        paymentMethod: 'CASH_SITE' as const,
        walletType: 'نقدي / كاش',
        walletNumber: '-',
      };

      // Act
      const { worker, welcomeWhatsAppUrl } = await workerService.createWorker(newWorkerData);

      // Assert
      expect(worker).toBeDefined();
      expect(worker.name).toBe('عبد الرحمن علي محمود السيد');
      expect(worker.name).not.toBe('');
      expect(worker.nickname).toBe('عبد الرحمن علي');
      expect(worker.aliases).toContain('عبد الرحمن علي');
      expect(worker.aliases).toContain('106');
      expect(welcomeWhatsAppUrl).toBeDefined();
      const decodedUrl = decodeURIComponent(welcomeWhatsAppUrl);
      expect(decodedUrl).toMatch(new RegExp(`start=inv_${worker.code}_[a-f0-9]+`));
      expect(decodedUrl).toContain('قسيمة راتبك');
      expect(decodedUrl).toContain('تأكيد وربط حسابي');
    });
  });

  describe('Worker Start Date Options & Flexible Manual Input', () => {
    it('generates accurate quick date options for today, yesterday, and day before yesterday', () => {
      // Arrange
      const today = PINNED_BASE_TIME;
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const dayBefore = new Date(today.getTime() - 48 * 60 * 60 * 1000);

      // Act
      const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
      const yesterdayStr = `${String(yesterday.getDate()).padStart(2, '0')}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${yesterday.getFullYear()}`;
      const dayBeforeStr = `${String(dayBefore.getDate()).padStart(2, '0')}-${String(dayBefore.getMonth() + 1).padStart(2, '0')}-${dayBefore.getFullYear()}`;

      // Assert
      expect(todayStr).toBe('21-09-2026');
      expect(yesterdayStr).toBe('20-09-2026');
      expect(dayBeforeStr).toBe('19-09-2026');
      expect(todayStr).not.toBe(yesterdayStr);
    });

    it('accurately parses various manual date formats using parseFlexibleDate', () => {
      // Arrange
      const validDate1 = '08-09-2026';
      const validDate2 = '2026-09-08';
      const validDate3 = '8/9/2026';
      const validDate4 = '٢٠٢٦/٠٩/٠٨';
      const invalidDate = 'تاريخ غير صحيح';

      // Act
      const d1 = parseFlexibleDate(validDate1);
      const d2 = parseFlexibleDate(validDate2);
      const d3 = parseFlexibleDate(validDate3);
      const d4 = parseFlexibleDate(validDate4);
      const invalid = parseFlexibleDate(invalidDate);

      // Assert
      expect(d1.isValid).toBe(true);
      expect(d1.formattedDMY).toBe('08-09-2026');
      expect(d2.isValid).toBe(true);
      expect(d2.formattedDMY).toBe('08-09-2026');
      expect(d3.isValid).toBe(true);
      expect(d3.formattedDMY).toBe('08-09-2026');
      expect(d4.isValid).toBe(true);
      expect(d4.formattedDMY).toBe('08-09-2026');
      expect(invalid.isValid).toBe(false);
      expect(invalid.isValid).not.toBe(true);
      expect(invalid.error).toBeDefined();
    });
  });
});
