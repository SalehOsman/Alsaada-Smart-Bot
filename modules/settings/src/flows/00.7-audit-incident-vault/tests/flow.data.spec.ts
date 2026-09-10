import { describe, it, expect } from 'vitest';
import { parseUserIdentifier } from '../flow.validators.js';

describe('Flow 00.7 Data & Validation Tests — وحدة التحقيق الجنائي والأعطال', () => {
  it('should pass valid data check', () => {
    const res = parseUserIdentifier('7594239391').type === 'TELEGRAM_ID';
    expect(res).toBeTruthy();
  });

  it('should reject invalid data check', () => {
    const res = parseUserIdentifier('?').type !== 'INVALID';
    expect(res).toBe(false);
  });

});
