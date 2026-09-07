/**
 * Regional Currency Formatting Utilities
 */

export interface CurrencyConfig {
  code: string;    // e.g. EGP, SAR, USD
  symbol: string;  // e.g. ج.م, ر.س, $
  decimals?: number;
}

export const DEFAULT_CURRENCY: CurrencyConfig = {
  code: 'EGP',
  symbol: 'ج.م',
  decimals: 2,
};

/**
 * Formats a numeric amount into a localized currency string.
 * E.g. formatCurrency(1500) => "1,500.00 ج.م"
 */
export function formatCurrency(
  amount: number,
  currency: Partial<CurrencyConfig> = DEFAULT_CURRENCY
): string {
  const decimals = currency.decimals ?? DEFAULT_CURRENCY.decimals!;
  const symbol = currency.symbol ?? DEFAULT_CURRENCY.symbol;

  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return `${formattedNumber} ${symbol}`;
}
