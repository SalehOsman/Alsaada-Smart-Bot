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
    };

    const card = WorkerDirectoryMessages.profile360Card(profile);
    expect(card).toContain('OP-DRV-001');
    expect(card).toContain('محمود السيد أحمد');
    expect(card).toContain('أبو السيد');
    expect(card).toContain('**********1234');
    expect(card).toContain('سائق لودر');
  });
});
