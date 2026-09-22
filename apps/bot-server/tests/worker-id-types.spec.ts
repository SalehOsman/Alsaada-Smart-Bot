import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workerService, setWorkforcePrisma } from '@alsaada/workforce';
import { prisma } from '../src/db.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

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
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.clearAllMocks();
    setWorkforcePrisma(prisma);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Egyptian National ID Validation & Extraction', () => {
    it('accurately parses and extracts demographic info from valid 14-digit Egyptian NID', () => {
      // Arrange
      const validNid = '29001010101234'; // Born 1990-01-01, Cairo (01), Male

      // Act
      const res = workerService.validateIdentification('NATIONAL_ID', validNid);

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.gender).toBe('MALE');
      expect(res.genderArabic).toBe('ذكر');
      expect(res.governorateCode).toBe('01');
      expect(res.governorateNameAr).toBe('القاهرة');
      expect(res.birthDate).toBeDefined();
    });

    it('rejects invalid length Egyptian NID', () => {
      // Arrange
      const shortNid = '2900101010123'; // 13 digits

      // Act
      const res = workerService.validateIdentification('NATIONAL_ID', shortNid);

      // Assert
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.error).not.toBe('');
    });

    it('rejects non-existent calendar dates in Egyptian NID', () => {
      // Arrange
      const invalidCalendarNid = '29002310101234'; // Feb 31st

      // Act
      const res = workerService.validateIdentification('NATIONAL_ID', invalidCalendarNid);

      // Assert
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('غير صالح تقويمياً');
      expect(res.error).not.toBeNull();
    });
  });

  describe('Foreign Worker Passport Validation', () => {
    it('accepts valid passport with custom nationality, birthdate, and gender', () => {
      // Arrange
      const birthDate = new Date('1994-08-15T00:00:00.000Z');
      const passportNo = 'P98765432';

      // Act
      const res = workerService.validateIdentification('PASSPORT', passportNo, {
        birthDate,
        gender: 'MALE',
      });

      // Assert
      expect(res.isValid).toBe(true);
      expect(res.gender).toBe('MALE');
      expect(res.genderArabic).toBe('ذكر');
      expect(res.governorateCode).toBe('88');
      expect(res.governorateNameAr).toContain('خارج الجمهورية');
      expect(res.age).toBeGreaterThan(25);
    });

    it('rejects passport when birthdate is missing', () => {
      // Arrange
      const passportNo = 'P98765432';

      // Act
      const res = workerService.validateIdentification('PASSPORT', passportNo, {
        gender: 'MALE',
      });

      // Assert
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('تاريخ الميلاد إلزامي');
    });

    it('rejects passport when gender is missing', () => {
      // Arrange
      const birthDate = new Date('1994-08-15T00:00:00.000Z');
      const passportNo = 'P98765432';

      // Act
      const res = workerService.validateIdentification('PASSPORT', passportNo, {
        birthDate,
      });

      // Assert
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('تحديد النوع');
    });

    it('rejects overly short passport number', () => {
      // Arrange
      const shortPassportNo = 'A12';
      const birthDate = new Date('1994-08-15T00:00:00.000Z');

      // Act
      const res = workerService.validateIdentification('PASSPORT', shortPassportNo, {
        birthDate,
        gender: 'FEMALE',
      });

      // Assert
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('بين 5 و 20');
    });
  });

  describe('Worker Code Generation & Structuring', () => {
    it('generates structured code OP-DRV-001 when no existing workers match', async () => {
      // Arrange
      const deptCode = 'OP';
      const jobCode = 'DRV';

      // Act
      const code = await workerService.generateNextWorkerCode(deptCode, jobCode);

      // Assert
      expect(code).toBe('OP-DRV-001');
      expect(code).not.toBe('');
      expect(code).not.toBe('OP-DRV-000');
    });
  });
});
