import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateTelegramId, validateRole, validateSearchQuery } from '../flow.validators.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.12 Data Tests — DTO & Validator Invariants', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates and normalizes Eastern Arabic numerals properly', () => {
    // Arrange
    const easternInput = '٧٥٩٤٢٣٩٣٩١';

    // Act
    const val = validateTelegramId(easternInput);

    // Assert
    expect(val.isValid).toBe(true);
    expect(val.normalizedId).toBe(7594239391n);
    expect(val.error).toBeUndefined();
  });

  it('rejects invalid or too short or non-numeric telegram IDs', () => {
    // Arrange
    const shortId = '123';
    const nonNumeric = 'abc';
    const emptyId = '';

    // Act
    const shortVal = validateTelegramId(shortId);
    const alphaVal = validateTelegramId(nonNumeric);
    const emptyVal = validateTelegramId(emptyId);

    // Assert
    expect(shortVal.isValid).toBe(false);
    expect(alphaVal.isValid).toBe(false);
    expect(emptyVal.isValid).toBe(false);
  });

  it('validates supported canonical RBAC roles and rejects invalid roles', () => {
    // Arrange
    const superAdmin = 'SUPER_ADMIN';
    const fieldAdmin = 'FIELD_ADMIN';
    const hackerRole = 'HACKER_ROLE';

    // Act
    const superResult = validateRole(superAdmin);
    const fieldResult = validateRole(fieldAdmin);
    const hackerResult = validateRole(hackerRole);

    // Assert
    expect(superResult).toBe(true);
    expect(fieldResult).toBe(true);
    expect(hackerResult).toBe(false);
  });

  it('validates search query string length and rejects empty or whitespace queries', () => {
    // Arrange
    const validQuery = 'أحمد';
    const emptyQuery = '';
    const whitespaceQuery = '   ';

    // Act
    const validResult = validateSearchQuery(validQuery);
    const emptyResult = validateSearchQuery(emptyQuery);
    const whitespaceResult = validateSearchQuery(whitespaceQuery);

    // Assert
    expect(validResult).toBe(true);
    expect(emptyResult).toBe(false);
    expect(whitespaceResult).toBe(false);
  });
});
