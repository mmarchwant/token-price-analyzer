import type { Currency, FxRates } from './types';

export function convertFromUsd(amountUsd: number, currency: Currency, fx: FxRates): number {
  const rate = fx.rates[currency];
  return amountUsd * rate;
}

export function convertToUsd(amount: number, currency: Currency, fx: FxRates): number {
  const rate = fx.rates[currency];
  return amount / rate;
}

export function applyVat(amount: number, vatRatePct: number): number {
  return amount * (1 + vatRatePct / 100);
}

export function removeVat(amount: number, vatRatePct: number): number {
  return amount / (1 + vatRatePct / 100);
}

export function formatMoney(
  amount: number,
  currency: Currency,
  locale: string,
  opts?: { maxFractionDigits?: number; compact?: boolean },
): string {
  const absAmount = Math.abs(amount);

  if (absAmount > 0 && absAmount < 0.01) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumSignificantDigits: 3,
      notation: opts?.compact ? 'compact' : 'standard',
    }).format(amount);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: opts?.maxFractionDigits ?? 2,
    notation: opts?.compact ? 'compact' : 'standard',
  }).format(amount);
}

export function formatTokens(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatPercent(x: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(x);
}
