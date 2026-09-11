import { describe, it, expect } from 'vitest';
import { validateTelegramId, validateRole, validateSearchQuery } from '../flow.validators.js';

describe('Flow 00.12 Data Tests — DTO & Validator Invariants', () => {
  it('validates and normalizes Eastern Arabic numerals properly', () => {
    // Eastern Arabic numerals: ٧٥٩٤٢٣٩٣٩١ -> 7594239391
    const easternInput = '٧٥٩٤٢٣٩٣٩١';
    const val = validateTelegramId(easternInput);
    expect(val.isValid).toBe(true);
    expect(val.normalizedId).toBe(7594239391n);
  });

  it('rejects invalid or too short/long telegram IDs', () => {
    expect(validateTelegramId('123').isValid).toBe(false);
    expect(validateTelegramId('abc').isValid).toBe(false);
    expect(validateTelegramId('').isValid).toBe(false);
  });

  it('validates supported RBAC roles', () => {
    expect(validateRole('SUPER_ADMIN')).toBe(true);
    expect(validateRole('FIELD_ADMIN')).toBe(true);
    expect(validateRole('WORKER')).toBe(true);
    expect(validateRole('HACKER_ROLE')).toBe(false);
  });

  it('validates search query string length', () => {
    expect(validateSearchQuery('أحمد')).toBe(true);
    expect(validateSearchQuery('')).toBe(false);
    expect(validateSearchQuery('   ')).toBe(false);
  });
});
