import { describe, it, expect } from 'vitest';
import {
  parseCoordinates,
  isValidLatLng,
  formatGoogleMapsUrl,
} from '../src/utils/coordinates.js';

describe('GPS Coordinates Parser Utility', () => {
  it('should parse plain comma-separated coordinates', () => {
    const res = parseCoordinates('25.4412, 30.5512');
    expect(res).toEqual({ latitude: 25.4412, longitude: 30.5512 });
  });

  it('should parse space-separated coordinates', () => {
    const res = parseCoordinates('25.4412 30.5512');
    expect(res).toEqual({ latitude: 25.4412, longitude: 30.5512 });
  });

  it('should parse negative coordinates', () => {
    const res = parseCoordinates('-12.3456, -77.1234');
    expect(res).toEqual({ latitude: -12.3456, longitude: -77.1234 });
  });

  it('should parse coordinates from Google Maps query link', () => {
    const url = 'https://maps.google.com/?q=25.441200,30.551200';
    const res = parseCoordinates(url);
    expect(res).toEqual({ latitude: 25.4412, longitude: 30.5512 });
  });

  it('should parse coordinates from Google Maps @ URL format', () => {
    const url = 'https://www.google.com/maps/@25.441234,30.551234,17z';
    const res = parseCoordinates(url);
    expect(res).toEqual({ latitude: 25.441234, longitude: 30.551234 });
  });

  it('should return null for invalid coordinates or text', () => {
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates('نص عشوائي')).toBeNull();
    expect(parseCoordinates('999.00, 999.00')).toBeNull(); // Out of range
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
