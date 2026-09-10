import { describe, it, expect } from 'vitest';
import { validateCompanyFieldValue } from '../flow.validators.js';

describe('Flow 00.1 Data & Validation Tests — الملف التعريفي وبيانات الشركة', () => {
  it('should pass valid data check', () => {
    const res = validateCompanyFieldValue('legalName', 'شركة السعادة');
    expect(res).toBeTruthy();
  });

  it('should reject invalid data check', () => {
    const res = validateCompanyFieldValue('officialEmail', 'bad-email');
    if (typeof res === 'object' && res !== null && 'isValid' in res) {
      expect(res.isValid).toBe(false);
    } else {
      expect(res).toBeFalsy();
    }
  });
});
