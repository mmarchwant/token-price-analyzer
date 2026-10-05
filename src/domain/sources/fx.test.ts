import { describe, expect, it } from 'vitest';
import frankfurterFixture from '../../../scripts/__fixtures__/frankfurter-latest.json';
import { normalizeFrankfurter } from './fx.js';

describe('normalizeFrankfurter', () => {
  it('normalizes valid Frankfurter FX response', () => {
    const fx = normalizeFrankfurter(frankfurterFixture);

    expect(fx.base).toBe('USD');
    expect(fx.date).toBe('2026-10-02');
    expect(fx.rates.USD).toBe(1);
    expect(fx.rates.EUR).toBe(0.89087);
    expect(fx.rates.PLN).toBe(3.8998);
  });

  it('throws descriptive error if PLN or EUR is missing or not positive', () => {
    expect(() =>
      normalizeFrankfurter({
        amount: 1,
        base: 'USD',
        date: '2026-10-02',
        rates: { EUR: 0.89 },
      }),
    ).toThrow(/Invalid Frankfurter response/);

    expect(() =>
      normalizeFrankfurter({
        amount: 1,
        base: 'USD',
        date: '2026-10-02',
        rates: { EUR: -0.5, PLN: 3.8 },
      }),
    ).toThrow(/Invalid Frankfurter response/);
  });
});
