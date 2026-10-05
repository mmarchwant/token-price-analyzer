import { describe, expect, it } from 'vitest';
import {
  applyVat,
  convertFromUsd,
  convertToUsd,
  formatMoney,
  formatPercent,
  formatTokens,
  removeVat,
} from './currency';
import type { FxRates } from './types';

describe('currency', () => {
  const fx: FxRates = {
    base: 'USD',
    date: '2025-01-15',
    rates: {
      USD: 1,
      PLN: 4.0,
      EUR: 0.9,
    },
  };

  it('converts to and from USD', () => {
    expect(convertFromUsd(10, 'PLN', fx)).toBe(40);
    expect(convertFromUsd(10, 'EUR', fx)).toBe(9);
    expect(convertFromUsd(10, 'USD', fx)).toBe(10);

    expect(convertToUsd(40, 'PLN', fx)).toBe(10);
    expect(convertToUsd(9, 'EUR', fx)).toBe(10);
  });

  it('applies and removes VAT (round trip)', () => {
    const net = 100;
    const vatRate = 23; // 23% PLN VAT
    const gross = applyVat(net, vatRate);
    expect(gross).toBe(123);
    expect(removeVat(gross, vatRate)).toBeCloseTo(net);
  });

  it('formats money for standard and small amounts (< 0.01) with optional compact format', () => {
    const usd12 = formatMoney(12.345, 'USD', 'en-US');
    expect(usd12).toContain('12.35');

    const smallUsd = formatMoney(0.00042, 'USD', 'en-US');
    expect(smallUsd).toContain('0.00042');

    const compactUsd = formatMoney(1000000, 'USD', 'en-US', { compact: true });
    expect(compactUsd).toContain('M');

    const compactSmallUsd = formatMoney(0.00042, 'USD', 'en-US', { compact: true });
    expect(compactSmallUsd).toContain('0.00042');

    const plnSmall = formatMoney(0.00042, 'PLN', 'pl-PL');
    expect(plnSmall.replace(/\s/g, ' ')).toContain('0,00042');
  });

  it('formats tokens', () => {
    const formatted = formatTokens(1200000, 'en-US');
    expect(formatted).toBe('1.2M');

    const formattedK = formatTokens(350000, 'en-US');
    expect(formattedK).toBe('350K');
  });

  it('formats percent', () => {
    const p1 = formatPercent(0.85, 'en-US');
    expect(p1).toBe('85%');

    const p2 = formatPercent(0.854, 'en-US');
    expect(p2).toBe('85.4%');
  });
});
