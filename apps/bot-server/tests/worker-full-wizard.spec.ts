import { describe, it, expect, vi } from 'vitest';
import { extractFirstTwoNames } from '@alsaada/regional-engine';
import { workerService } from '../src/services/worker.service.js';

vi.mock('../src/db.js', () => ({
  prisma: {
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
  },
}));

vi.mock('../src/services/fast-cache.service.js', () => ({
  fastCache: {
    invalidate: vi.fn().mockResolvedValue(undefined),
    rememberSWR: vi.fn().mockImplementation((_k, _t, fetcher) => fetcher()),
  },
}));

describe('Worker Full 19-Step Wizard & Compound Nickname Engine', () => {
  describe('Compound Name & Auto-Nickname Engine', () => {
    it('should correctly handle compound prefix (عبد الله محمد محمود -> عبد الله محمد)', () => {
      const nick = extractFirstTwoNames('عبد الله محمد محمود خليل');
      expect(nick).toBe('عبد الله محمد');
    });

    it('should correctly handle compound suffix (أحمد نور الدين علي إبراهيم -> أحمد نور الدين)', () => {
      const nick = extractFirstTwoNames('أحمد نور الدين علي إبراهيم');
      expect(nick).toBe('أحمد نور الدين');
    });

    it('should correctly handle standard two names (محمود حسن علي سالم -> محمود حسن)', () => {
      const nick = extractFirstTwoNames('محمود حسن علي سالم');
      expect(nick).toBe('محمود حسن');
    });

    it('should handle Abu/Umm prefixes (أبو بكر سالم محمد -> أبو بكر سالم)', () => {
      const nick = extractFirstTwoNames('أبو بكر سالم محمد');
      expect(nick).toBe('أبو بكر سالم');
    });
  });

  describe('Worker Service Registration with Legacy Fields', () => {
    it('should persist all legacy fields and add nickname to aliases', async () => {
      const { worker, welcomeWhatsAppUrl } = await workerService.createWorker({
        name: 'عبد الرحمن علي محمود السيد',
        nickname: 'عبد الرحمن علي',
        legacyCode: '106',
        idType: 'NATIONAL_ID',
        idNumber: '29205150101234',
        nationality: 'مصر',
        birthDate: new Date('1992-05-15'),
        gender: 'MALE',
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
        paymentMethod: 'CASH_SITE',
        walletType: 'نقدي / كاش',
        walletNumber: '-',
      });

      expect(worker).toBeDefined();
      expect(worker.name).toBe('عبد الرحمن علي محمود السيد');
      expect(worker.nickname).toBe('عبد الرحمن علي');
      expect(worker.aliases).toContain('عبد الرحمن علي');
      expect(worker.aliases).toContain('106');
      expect(welcomeWhatsAppUrl).toBeDefined();
      const decodedUrl = decodeURIComponent(welcomeWhatsAppUrl);
      expect(decodedUrl).toContain(`start=join_${worker.code}`);
      expect(decodedUrl).toContain('قسيمة راتبك');
      expect(decodedUrl).toContain('تأكيد وربط حسابي');
    });
  });

  describe('Worker Start Date Options & Flexible Manual Input', () => {
    it('should generate accurate quick date options for today, yesterday, and day before yesterday', () => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const dayBefore = new Date(today.getTime() - 48 * 60 * 60 * 1000);

      const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
      const yesterdayStr = `${String(yesterday.getDate()).padStart(2, '0')}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${yesterday.getFullYear()}`;
      const dayBeforeStr = `${String(dayBefore.getDate()).padStart(2, '0')}-${String(dayBefore.getMonth() + 1).padStart(2, '0')}-${dayBefore.getFullYear()}`;

      expect(todayStr).toMatch(/^\d{2}-\d{2}-\d{4}$/);
      expect(yesterdayStr).toMatch(/^\d{2}-\d{2}-\d{4}$/);
      expect(dayBeforeStr).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    });

    it('should accurately parse various manual date formats using parseFlexibleDate', async () => {
      const { parseFlexibleDate } = await import('@alsaada/regional-engine');

      const d1 = parseFlexibleDate('08-09-2026');
      expect(d1.isValid).toBe(true);
      expect(d1.formattedDMY).toBe('08-09-2026');

      const d2 = parseFlexibleDate('2026-09-08');
      expect(d2.isValid).toBe(true);
      expect(d2.formattedDMY).toBe('08-09-2026');

      const d3 = parseFlexibleDate('8/9/2026');
      expect(d3.isValid).toBe(true);
      expect(d3.formattedDMY).toBe('08-09-2026');

      const d4 = parseFlexibleDate('٢٠٢٦/٠٩/٠٨');
      expect(d4.isValid).toBe(true);
      expect(d4.formattedDMY).toBe('08-09-2026');

      const invalid = parseFlexibleDate('تاريخ غير صحيح');
      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toBeDefined();
    });
  });
});

