import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workerService, setWorkforcePrisma } from '@alsaada/workforce';
import { prisma } from '../src/db.js';

vi.mock('../src/db.js', () => {
  return {
    prisma: {
      worker: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      jobTitle: {
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock('../src/services/fast-cache.service.js', () => ({
  fastCache: {
    invalidate: vi.fn().mockResolvedValue(undefined),
    rememberSWR: vi.fn().mockImplementation((_k, _t, fetcher) => fetcher()),
  },
}));

describe('Worker Identification Engine — Egyptian NID & Foreign Passport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setWorkforcePrisma(prisma);
  });
  describe('Egyptian National ID Validation & Extraction', () => {
    it('should accurately parse and extract info from valid 14-digit Egyptian NID', () => {
      // 29001010101234 -> Born 1990-01-01, Cairo (01), Male
      const res = workerService.validateIdentification('NATIONAL_ID', '29001010101234');
      expect(res.isValid).toBe(true);
      expect(res.gender).toBe('MALE');
      expect(res.genderArabic).toBe('ذكر');
      expect(res.governorateCode).toBe('01');
      expect(res.governorateNameAr).toBe('القاهرة');
      expect(res.birthDate).toBeDefined();
    });

    it('should reject invalid length Egyptian NID', () => {
      const res = workerService.validateIdentification('NATIONAL_ID', '2900101010123'); // 13 digits
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('should reject non-existent calendar dates in Egyptian NID', () => {
      const res = workerService.validateIdentification('NATIONAL_ID', '29002310101234'); // Feb 31st
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('غير صالح تقويمياً');
    });
  });

  describe('Foreign Worker Passport Validation', () => {
    it('should accept valid passport with custom nationality, birthdate, and gender', () => {
      const birthDate = new Date('1994-08-15');
      const res = workerService.validateIdentification('PASSPORT', 'P98765432', {
        birthDate,
        gender: 'MALE',
      });

      expect(res.isValid).toBe(true);
      expect(res.gender).toBe('MALE');
      expect(res.genderArabic).toBe('ذكر');
      expect(res.governorateCode).toBe('88');
      expect(res.governorateNameAr).toContain('خارج الجمهورية');
      expect(res.age).toBeGreaterThan(25);
    });

    it('should reject passport with missing birthdate', () => {
      const res = workerService.validateIdentification('PASSPORT', 'P98765432', {
        gender: 'MALE',
      });

      expect(res.isValid).toBe(false);
      expect(res.error).toContain('تاريخ الميلاد إلزامي');
    });

    it('should reject passport with missing gender', () => {
      const res = workerService.validateIdentification('PASSPORT', 'P98765432', {
        birthDate: new Date('1994-08-15'),
      });

      expect(res.isValid).toBe(false);
      expect(res.error).toContain('تحديد النوع');
    });

    it('should reject overly short passport number', () => {
      const res = workerService.validateIdentification('PASSPORT', 'A12', {
        birthDate: new Date('1994-08-15'),
        gender: 'FEMALE',
      });

      expect(res.isValid).toBe(false);
      expect(res.error).toContain('بين 5 و 20');
    });
  });

  describe('Worker Code Generation & Structuring', () => {
    it('should generate structured code OP-DRV-001 when no existing workers match', async () => {
      const code = await workerService.generateNextWorkerCode('OP', 'DRV');
      expect(code).toBe('OP-DRV-001');
    });
  });
});
