import { describe, it, expect, vi } from 'vitest';
import {
  parseCoordinates,
  isValidLatLng,
  formatGoogleMapsUrl,
} from '../src/utils/coordinates.js';

describe('GPS Coordinates Parser Utility', () => {
  it('should parse plain comma-separated coordinates', async () => {
    const res = await parseCoordinates('25.4412, 30.5512');
    expect(res).toEqual({ latitude: 25.4412, longitude: 30.5512 });
  });

  it('should parse space-separated coordinates', async () => {
    const res = await parseCoordinates('25.4412 30.5512');
    expect(res).toEqual({ latitude: 25.4412, longitude: 30.5512 });
  });

  it('should parse negative coordinates', async () => {
    const res = await parseCoordinates('-12.3456, -77.1234');
    expect(res).toEqual({ latitude: -12.3456, longitude: -77.1234 });
  });

  it('should parse coordinates from Google Maps query link', async () => {
    const url = 'https://maps.google.com/?q=25.441200,30.551200';
    const res = await parseCoordinates(url);
    expect(res).toEqual({ latitude: 25.4412, longitude: 30.5512 });
  });

  it('should parse coordinates from Google Maps @ URL format', async () => {
    const url = 'https://www.google.com/maps/@25.441234,30.551234,17z';
    const res = await parseCoordinates(url);
    expect(res).toEqual({ latitude: 25.441234, longitude: 30.551234 });
  });

  it('should resolve and parse shortened Google Maps links (maps.app.goo.gl)', async () => {
    // Mock fetch redirect
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

    try {
      const res = await parseCoordinates('https://maps.app.goo.gl/BET1jfCMWP1osqdr8');
      expect(res).toEqual({ latitude: 25.336338, longitude: 30.2968969 });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should return null for invalid coordinates or text', async () => {
    expect(await parseCoordinates('')).toBeNull();
    expect(await parseCoordinates('نص عشوائي')).toBeNull();
    expect(await parseCoordinates('999.00, 999.00')).toBeNull(); // Out of range
  });

  it('should validate lat/lng range correctly', () => {
    expect(isValidLatLng(90, 180)).toBe(true);
    expect(isValidLatLng(-90, -180)).toBe(true);
    expect(isValidLatLng(90.1, 50)).toBe(false);
    expect(isValidLatLng(50, 180.1)).toBe(false);
  });

  it('should format Google Maps URL correctly', () => {
    expect(formatGoogleMapsUrl(25.44, 30.55)).toBe('https://www.google.com/maps?q=25.44,30.55');
  });
});
