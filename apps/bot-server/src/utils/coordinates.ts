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

function extractFromText(text: string): ParsedCoordinates | null {
  if (!text) return null;

  // 1. Plain comma or space separated: "25.4412, 30.5512" or "25.4412 30.5512"
  const plainMatch = text.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (plainMatch) {
    const lat = parseFloat(plainMatch[1]);
    const lng = parseFloat(plainMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 2. Google Maps exact place pin: !3d25.336338!4d30.2968969
  const pinMatch = text.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
  if (pinMatch) {
    const lat = parseFloat(pinMatch[1]);
    const lng = parseFloat(pinMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 3. Google Maps URL query pattern: ?q=25.4412,30.5512 or &q=25.4412,30.5512
  const urlQMatch = text.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (urlQMatch) {
    const lat = parseFloat(urlQMatch[1]);
    const lng = parseFloat(urlQMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 4. Google Maps URL path pattern: @25.4412,30.5512,17z
  const urlAtMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (urlAtMatch) {
    const lat = parseFloat(urlAtMatch[1]);
    const lng = parseFloat(urlAtMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 5. Loose pattern with text before/after: "Location: 25.4412, 30.5512"
  const looseMatch = text.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  if (looseMatch) {
    const lat = parseFloat(looseMatch[1]);
    const lng = parseFloat(looseMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  return null;
}

export async function parseCoordinates(input: string): Promise<ParsedCoordinates | null> {
  if (!input) return null;
  const trimmed = input.trim();

  // First check direct static parsing
  const staticResult = extractFromText(trimmed);
  if (staticResult) {
    return staticResult;
  }

  // If it's a URL (like shortened Google Maps link maps.app.goo.gl or goo.gl/maps)
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const res = await fetch(trimmed, {
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      const redirectTarget = res.headers.get('location') || res.url;
      if (redirectTarget) {
        const parsed = extractFromText(redirectTarget);
        if (parsed) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to resolve shortened Google Maps URL:', err);
    }
  }

  return null;
}

export function formatGoogleMapsUrl(latitude: number | string, longitude: number | string): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
