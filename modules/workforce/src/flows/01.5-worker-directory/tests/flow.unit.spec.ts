import { describe, it, expect } from 'vitest';
import {
  validateDirectorySearchQuery,
  validateDirectoryPage,
  validateWorkerIdParam,
} from '../flow.validators.js';
import { WorkerDirectoryMessages } from '../flow.messages.js';
import type { WorkerProfile360 } from '../flow.types.js';

describe('Flow 01.5 Unit Tests — Worker Directory & 360 Profile Validators', () => {
  it('should validate search queries and trim whitespace correctly', () => {
    const valid = validateDirectorySearchQuery('  أحمد علي  ');
    expect(valid.isValid).toBe(true);
    expect(valid.cleanQuery).toBe('أحمد علي');

    const empty = validateDirectorySearchQuery('   ');
    expect(empty.isValid).toBe(false);
    expect(empty.error).toBeDefined();

    const tooLong = validateDirectorySearchQuery('a'.repeat(60));
    expect(tooLong.isValid).toBe(false);
  });

  it('should validate page numbers and fallback safely to page 1', () => {
    expect(validateDirectoryPage('3')).toBe(3);
    expect(validateDirectoryPage(-5)).toBe(1);
    expect(validateDirectoryPage('invalid')).toBe(1);
  });

  it('should validate worker id parameters', () => {
    expect(validateWorkerIdParam('wrk-123').isValid).toBe(true);
    expect(validateWorkerIdParam('   ').isValid).toBe(false);
  });

  it('should render a 360 profile card with masked ID and Arabic labels', () => {
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

    const card = WorkerDirectoryMessages.profile360Card(profile);
    expect(card).toContain('OP-DRV-001');
    expect(card).toContain('محمود السيد أحمد');
    expect(card).toContain('أبو السيد');
    expect(card).toContain('**********1234');
    expect(card).toContain('سائق لودر');
    expect(card).toContain('مكتمل بنسبة 100%');
  });

  it('should render incomplete profile status and list missing items in 360 card', () => {
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

    const card = WorkerDirectoryMessages.profile360Card(profile);
    expect(card).toContain('غير مكتمل (60%)');
    expect(card).toContain('صورة وجه البطاقة');
    expect(card).toContain('رقم هاتف الطوارئ');
    expect(card).toContain('رخصة القيادة');
  });

  it('should toggle full national ID when isIdRevealed is true', () => {
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

    const card = WorkerDirectoryMessages.profile360Card(profile);
    expect(card).toContain('29102052502159');
  });

  it('should format missing data WhatsApp message and dispatch card with 1-tap copy', () => {
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

    const msg = WorkerDirectoryMessages.formatMissingDataWhatsAppMessage(profile);
    expect(msg).toContain('أبو علي');
    expect(msg).toContain('1. صورة البطاقة الشخصية');
    expect(msg).toContain('2. رخصة القيادة المهنية');

    const card = WorkerDirectoryMessages.missingDataDispatchCard(profile, msg);
    expect(card).toContain('طلب استكمال النواقص والمستندات عبر واتساب');
    expect(card).toContain('```');
    expect(card).toContain('50%');
  });
});
