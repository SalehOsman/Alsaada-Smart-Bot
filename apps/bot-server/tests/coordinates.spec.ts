import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseCoordinates,
  isValidLatLng,
  formatGoogleMapsUrl,
} from '../src/utils/coordinates.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('GPS Coordinates Parser Utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it('parses plain comma-separated coordinates into latitude and longitude', async () => {
    // Arrange
    const input = '25.4412, 30.5512';

    // Act
    const res = await parseCoordinates(input);

    // Assert
    expect(res).not.toBeNull();
    expect(res).toEqual({ latitude: 25.4412, longitude: 30.5512 });
    expect(res?.latitude).toBe(25.4412);
    expect(res?.longitude).toBe(30.5512);
  });

  it('parses space-separated coordinates correctly', async () => {
    // Arrange
    const input = '25.4412 30.5512';

    // Act
    const res = await parseCoordinates(input);

    // Assert
    expect(res).not.toBeNull();
    expect(res).toEqual({ latitude: 25.4412, longitude: 30.5512 });
    expect(res?.latitude).toBeGreaterThan(0);
    expect(res?.longitude).toBeGreaterThan(0);
  });

  it('parses negative coordinates representing southern or western hemispheres', async () => {
    // Arrange
    const input = '-12.3456, -77.1234';

    // Act
    const res = await parseCoordinates(input);

    // Assert
    expect(res).not.toBeNull();
    expect(res).toEqual({ latitude: -12.3456, longitude: -77.1234 });
    expect(res?.latitude).toBeLessThan(0);
    expect(res?.longitude).toBeLessThan(0);
  });

  it('parses coordinates from Google Maps query link parameter', async () => {
    // Arrange
    const url = 'https://maps.google.com/?q=25.441200,30.551200';

    // Act
    const res = await parseCoordinates(url);

    // Assert
    expect(res).not.toBeNull();
    expect(res).toEqual({ latitude: 25.4412, longitude: 30.5512 });
    expect(res?.latitude).toBe(25.4412);
    expect(res?.longitude).toBe(30.5512);
  });

  it('parses coordinates from Google Maps @ URL format with zoom level', async () => {
    // Arrange
    const url = 'https://www.google.com/maps/@25.441234,30.551234,17z';

    // Act
    const res = await parseCoordinates(url);

    // Assert
    expect(res).not.toBeNull();
    expect(res).toEqual({ latitude: 25.441234, longitude: 30.551234 });
    expect(res?.latitude).toBeCloseTo(25.441234, 5);
  });

  it('resolves and parses shortened Google Maps links through redirect header', async () => {
    // Arrange
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      status: 302,
      headers: {
        get: (h: string) =>
          h.toLowerCase() === 'location'
            ? 'https://www.google.com/maps/place/Phosphate/@25.336338,30.2990856,17z/data=!3m1!4b1!4m6!3m5!1s0x144757b75ffa91f5:0xb3879dea09f6c0ed!8m2!3d25.336338!4d30.2968969'
            : null,
      },
      url: 'https://maps.app.goo.gl/BET1jfCMWP1osqdr8',
    } as any);

    // Act
    let res: any;
    try {
      res = await parseCoordinates('https://maps.app.goo.gl/BET1jfCMWP1osqdr8');
    } finally {
      global.fetch = originalFetch;
    }

    // Assert
    expect(res).not.toBeNull();
    expect(res).toEqual({ latitude: 25.336338, longitude: 30.2968969 });
    expect(res.latitude).toBeCloseTo(25.336338, 5);
    expect(res.longitude).toBeCloseTo(30.2968969, 5);
  });

  it('returns null for empty string or invalid non-coordinate text', async () => {
    // Arrange
    const emptyInput = '';
    const arbitraryText = 'نص عشوائي غير صالح';

    // Act
    const emptyResult = await parseCoordinates(emptyInput);
    const textResult = await parseCoordinates(arbitraryText);

    // Assert
    expect(emptyResult).toBeNull();
    expect(textResult).toBeNull();
    expect(emptyResult).not.toEqual(expect.anything());
  });

  it('returns null when coordinates exceed physical latitude or longitude bounds', async () => {
    // Arrange
    const outOfBoundsInput = '999.00, 999.00';

    // Act
    const res = await parseCoordinates(outOfBoundsInput);

    // Assert
    expect(res).toBeNull();
    expect(isValidLatLng(999.0, 999.0)).toBe(false);
  });

  it('validates physical latitude and longitude bounds accurately', () => {
    // Arrange
    const validMax = { lat: 90, lng: 180 };
    const validMin = { lat: -90, lng: -180 };
    const invalidLat = { lat: 90.1, lng: 50 };
    const invalidLng = { lat: 50, lng: 180.1 };

    // Act & Assert
    expect(isValidLatLng(validMax.lat, validMax.lng)).toBe(true);
    expect(isValidLatLng(validMin.lat, validMin.lng)).toBe(true);
    expect(isValidLatLng(invalidLat.lat, invalidLat.lng)).toBe(false);
    expect(isValidLatLng(invalidLng.lat, invalidLng.lng)).toBe(false);
    expect(isValidLatLng(NaN, 50)).toBe(false);
  });

  it('formats Google Maps URL string accurately from latitude and longitude', () => {
    // Arrange
    const lat = 25.44;
    const lng = 30.55;

    // Act
    const url = formatGoogleMapsUrl(lat, lng);

    // Assert
    expect(url).toBe('https://www.google.com/maps?q=25.44,30.55');
    expect(url).toContain('https://www.google.com/maps?q=');
    expect(url).not.toContain('undefined');
  });
});
