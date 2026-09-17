import type { TelegramLocationResult } from './types.js';

/**
 * Safely parses and extracts valid GPS latitude and longitude from a Telegram context.
 * Supports:
 * - Native location objects (message.location, channelPost.location, editedMessage.location)
 * - Telegram Venue objects (message.venue.location)
 * - Plain text coordinates (e.g. "30.0444, 31.2357" or "30.0444 31.2357")
 * - Google Maps URL coordinates (e.g. "https://maps.google.com/?q=30.0444,31.2357")
 * Validates coordinate ranges (-90 <= lat <= 90, -180 <= lng <= 180).
 */
export function parseTelegramLocation(ctx: unknown): TelegramLocationResult | null {
  if (!ctx || typeof ctx !== 'object') return null;
  const context = ctx as {
    message?: {
      location?: {
        latitude?: unknown;
        longitude?: unknown;
      };
      venue?: {
        location?: {
          latitude?: unknown;
          longitude?: unknown;
        };
      };
      text?: string;
    };
    channelPost?: {
      location?: {
        latitude?: unknown;
        longitude?: unknown;
      };
      venue?: {
        location?: {
          latitude?: unknown;
          longitude?: unknown;
        };
      };
      text?: string;
    };
    editedMessage?: {
      location?: {
        latitude?: unknown;
        longitude?: unknown;
      };
      venue?: {
        location?: {
          latitude?: unknown;
          longitude?: unknown;
        };
      };
      text?: string;
    };
  };

  const loc =
    context.message?.location ??
    context.message?.venue?.location ??
    context.channelPost?.location ??
    context.channelPost?.venue?.location ??
    context.editedMessage?.location ??
    context.editedMessage?.venue?.location;

  if (loc) {
    const lat = typeof loc.latitude === 'number' ? loc.latitude : Number(loc.latitude);
    const lng = typeof loc.longitude === 'number' ? loc.longitude : Number(loc.longitude);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  const text =
    context.message?.text ??
    context.channelPost?.text ??
    context.editedMessage?.text;

  if (typeof text === 'string' && text.trim().length > 0) {
    const trimmed = text.trim();
    // 1. Google Maps URL pattern: e.g. https://maps.google.com/?q=30.0444,31.2357 or /@30.0444,31.2357
    const mapsMatch = trimmed.match(/(?:[?&]q=|\/@)(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (mapsMatch?.[1] && mapsMatch?.[2]) {
      const lat = Number(mapsMatch[1]);
      const lng = Number(mapsMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }

    // 2. Plain text coordinates: "30.0444, 31.2357" or "30.0444,31.2357" or "30.0444 31.2357"
    const coordsMatch = trimmed.match(/^\s*(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)\s*$/);
    if (coordsMatch?.[1] && coordsMatch?.[2]) {
      const lat = Number(coordsMatch[1]);
      const lng = Number(coordsMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  return null;
}
