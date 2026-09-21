/**
 * Deterministic Pinned Clock for Enterprise Unit and Integration Tests
 * Eliminates timezone and execution-time drift.
 */

export const PINNED_BASE_TIME = new Date("2026-09-21T06:00:00.000Z");

export function getPinnedTime(offsetMs = 0): Date {
  return new Date(PINNED_BASE_TIME.getTime() + offsetMs);
}
