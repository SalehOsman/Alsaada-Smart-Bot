/**
 * Domain Currency & Monetary Calculation Utilities
 */

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function roundToTwoDecimals(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatEgp(amount: number): string {
  const rounded = roundToTwoDecimals(amount);
  return `${rounded.toFixed(2)} ج.م`;
}
