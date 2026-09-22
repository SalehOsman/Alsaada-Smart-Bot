import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateDirectorySearchQuery,
  validateDirectoryPage,
  validateWorkerIdParam,
} from '../flow.validators.js';
import { WorkerDirectoryMessages } from '../flow.messages.js';
import type { WorkerProfile360 } from '../flow.types.js';

describe('Flow 01.5 Unit Tests — Worker Directory & 360 Profile Validators', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('validates search queries and trims whitespace correctly', () => {
    // Arrange
    const validRaw = '  أحمد علي  ';
    const emptyRaw = '   ';
    const tooLongRaw = 'a'.repeat(60);

    // Act
    const valid = validateDirectorySearchQuery(validRaw);
    const empty = validateDirectorySearchQuery(emptyRaw);
    const tooLong = validateDirectorySearchQuery(tooLongRaw);

    // Assert
    expect(valid.isValid).toBe(true);
    expect(valid.cleanQuery).toBe('أحمد علي');
    expect(empty.isValid).toBe(false);
    expect(empty.error).toBeDefined();
    expect(tooLong.isValid).toBe(false);
    expect(empty.cleanQuery).toBeUndefined();
  });

  it('validates page numbers and fallbacks safely to page 1', () => {
    // Arrange
    const validRaw = '3';
    const negativeRaw = -5;
    const invalidRaw = 'invalid';

    // Act
    const validPage = validateDirectoryPage(validRaw);
    const negativePage = validateDirectoryPage(negativeRaw);
    const invalidPage = validateDirectoryPage(invalidRaw);

    // Assert
    expect(validPage).toBe(3);
    expect(negativePage).toBe(1);
    expect(invalidPage).toBe(1);
    expect(negativePage).not.toBe(-5);
  });

  it('validates worker id parameters correctly', () => {
    // Arrange
    const validId = 'wrk-123';
    const emptyId = '   ';

    // Act
    const validRes = validateWorkerIdParam(validId);
    const invalidRes = validateWorkerIdParam(emptyId);

    // Assert
    expect(validRes.isValid).toBe(true);
    expect(invalidRes.isValid).toBe(false);
    expect(invalidRes.error).toBeDefined();
  });

  it('renders a 360 profile card with masked ID and Arabic labels', () => {
    // Arrange
    const profile: WorkerProfile360 = {
      id: 'wrk-1',
      code: 'OP-DRV-001',
      name: 'محمود السيد أحمد',
      nickname: 'أبو السيد',
      idType: 'NATIONAL_ID',
      idNumberMasked: '**********1234',
      phone: '01012345678',
      jobTitle: 'سائق لودر',
      siteName: 'موقع السباعية',
      hireDate: new Date('2026-09-01'),
      shiftSystem: 'دورة 30+10',
      dailyWageMasked: '•••••• ج.م (محجوب)',
      status: 'ACTIVE',
      isProfileComplete: true,
      completionPercentage: 100,
      missingItems: [],
    };

    // Act
    const card = WorkerDirectoryMessages.profile360Card(profile);

    // Assert
    expect(card).toContain('OP-DRV-001');
    expect(card).toContain('محمود السيد أحمد');
    expect(card).toContain('أبو السيد');
    expect(card).toContain('**********1234');
    expect(card).toContain('سائق لودر');
    expect(card).toContain('مكتمل بنسبة 100%');
    expect(card).not.toContain('غير مكتمل');
  });

  it('renders incomplete profile status and lists missing items in 360 card', () => {
    // Arrange
    const profile: WorkerProfile360 = {
      id: 'wrk-2',
      code: 'OP-DRV-002',
      name: 'علي حسن',
      idType: 'NATIONAL_ID',
      idNumberMasked: '**********5678',
      jobTitle: 'سائق لودر',
      hireDate: new Date('2026-09-01'),
      status: 'ACTIVE',
      isProfileComplete: false,
      completionPercentage: 60,
      missingItems: ['صورة وجه البطاقة', 'رقم هاتف الطوارئ', 'رخصة القيادة'],
    };

    // Act
    const card = WorkerDirectoryMessages.profile360Card(profile);

    // Assert
    expect(card).toContain('غير مكتمل (60%)');
    expect(card).toContain('صورة وجه البطاقة');
    expect(card).toContain('رقم هاتف الطوارئ');
    expect(card).toContain('رخصة القيادة');
    expect(card).not.toContain('مكتمل بنسبة 100%');
  });

  it('toggles full national ID when isIdRevealed is true', () => {
    // Arrange
    const profile: WorkerProfile360 = {
      id: 'wrk-3',
      code: 'OP-DRV-003',
      name: 'سالم محمود',
      idType: 'NATIONAL_ID',
      idNumberMasked: '291••••••••159',
      idNumberFull: '29102052502159',
      canRevealId: true,
      jobTitle: 'فني ميكانيكا',
      hireDate: new Date('2026-09-01'),
      status: 'ACTIVE',
      isProfileComplete: true,
      completionPercentage: 100,
      missingItems: [],
    };

    // Act
    const card = WorkerDirectoryMessages.profile360Card(profile);

    // Assert
    expect(card).toContain('29102052502159');
    expect(card).not.toContain('291••••••••159');
  });

  it('formats missing data WhatsApp message and dispatch card with 1-tap copy', () => {
    // Arrange
    const profile: WorkerProfile360 = {
      id: 'wrk-4',
      code: 'OP-DRV-004',
      name: 'حسام البدري',
      nickname: 'أبو علي',
      idType: 'NATIONAL_ID',
      idNumberMasked: '**********9999',
      phone: '01012345678',
      jobTitle: 'سائق',
      hireDate: new Date('2026-09-01'),
      status: 'ACTIVE',
      isProfileComplete: false,
      completionPercentage: 50,
      missingItems: ['صورة البطاقة الشخصية', 'رخصة القيادة المهنية'],
    };

    // Act
    const msg = WorkerDirectoryMessages.formatMissingDataWhatsAppMessage(profile);
    const card = WorkerDirectoryMessages.missingDataDispatchCard(profile, msg);

    // Assert
    expect(msg).toContain('أبو علي');
    expect(msg).toContain('1. صورة البطاقة الشخصية');
    expect(msg).toContain('2. رخصة القيادة المهنية');
    expect(card).toContain('طلب استكمال النواقص والمستندات عبر واتساب');
    expect(card).toContain('```');
    expect(card).toContain('50%');
    expect(card).not.toContain('100%');
  });
});
