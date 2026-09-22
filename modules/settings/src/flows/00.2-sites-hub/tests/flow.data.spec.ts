import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateSiteName, validateSiteCode, parseSiteCoordinates } from '../flow.validators.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.2 Data & Validation Tests — مصفوفة المشاريع والمواقع الميدانية', () => {
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

  it('validates standard site name successfully', () => {
    // Arrange
    const siteName = 'موقع السويس للإنشاءات';

    // Act
    const res = validateSiteName(siteName);

    // Assert
    expect(res.isValid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('rejects site names that are too short or empty', () => {
    // Arrange
    const shortName = 'a';
    const emptyName = '   ';

    // Act
    const shortRes = validateSiteName(shortName);
    const emptyRes = validateSiteName(emptyName);

    // Assert
    expect(shortRes.isValid).toBe(false);
    expect(emptyRes.isValid).toBe(false);
    expect(shortRes.error).toContain('لا يقل عن 3 أحرف');
  });

  it('validates canonical site code format and rejects invalid symbols', () => {
    // Arrange
    const validCode = 'STE-01';
    const invalidCode = 'site code with spaces';

    // Act
    const validRes = validateSiteCode(validCode);
    const invalidRes = validateSiteCode(invalidCode);

    // Assert
    expect(validRes.isValid).toBe(true);
    expect(invalidRes.isValid).toBe(false);
  });

  it('parses geographic coordinates string and rejects invalid coordinates', () => {
    // Arrange
    const validCoords = '29.9668, 32.5498';
    const invalidCoords = '999.999, 999.999';

    // Act
    const parsedValid = parseSiteCoordinates(validCoords);
    const parsedInvalid = parseSiteCoordinates(invalidCoords);

    // Assert
    expect(parsedValid).toBeDefined();
    expect(parsedValid?.lat).toBe(29.9668);
    expect(parsedValid?.lng).toBe(32.5498);
    expect(parsedInvalid).toBeNull();
  });
});
