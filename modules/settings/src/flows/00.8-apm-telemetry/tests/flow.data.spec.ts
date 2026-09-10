import { describe, it, expect } from 'vitest';
import { validateAlertPolicy } from '../flow.validators.js';

describe('Flow 00.8 Data & Validation Tests — رادار الأداء ومراقبة الخدمات', () => {
  it('should pass valid data check', () => {
    const res = validateAlertPolicy('SMART');
    expect(res).toBeTruthy();
  });

  it('should reject invalid data check', () => {
    const res = validateAlertPolicy('INVALID');
    expect(res).toBe(false);
  });

});
