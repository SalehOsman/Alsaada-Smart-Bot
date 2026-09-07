/**
 * Utility for parsing GPS coordinates from user text input, decimal pairs, or Google Maps URLs.
 */

export interface ParsedCoordinates {
  latitude: number;
  longitude: number;
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function parseCoordinates(input: string): ParsedCoordinates | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Plain comma or space separated: "25.4412, 30.5512" or "25.4412 30.5512"
  const plainMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (plainMatch) {
    const lat = parseFloat(plainMatch[1]);
    const lng = parseFloat(plainMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 2. Google Maps URL query pattern: ?q=25.4412,30.5512 or &q=25.4412,30.5512
  const urlQMatch = trimmed.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (urlQMatch) {
    const lat = parseFloat(urlQMatch[1]);
    const lng = parseFloat(urlQMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 3. Google Maps URL path pattern: @25.4412,30.5512,17z
  const urlAtMatch = trimmed.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (urlAtMatch) {
    const lat = parseFloat(urlAtMatch[1]);
    const lng = parseFloat(urlAtMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 4. Loose pattern with text before/after: "Location: 25.4412, 30.5512"
  const looseMatch = trimmed.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  if (looseMatch) {
    const lat = parseFloat(looseMatch[1]);
    const lng = parseFloat(looseMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  return null;
}

export function formatGoogleMapsUrl(latitude: number | string, longitude: number | string): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
