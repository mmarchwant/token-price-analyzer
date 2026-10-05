import { z } from 'zod';
import type { FxRates } from '../types.js';

const FrankfurterResponseSchema = z.object({
  base: z.string(),
  date: z.string(),
  rates: z.object({
    EUR: z.number().gt(0),
    PLN: z.number().gt(0),
  }),
});

export function normalizeFrankfurter(raw: unknown): FxRates {
  const result = FrankfurterResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid Frankfurter response: expected PLN and EUR rates > 0. Details: ${result.error.message}`,
    );
  }

  const data = result.data;
  return {
    base: 'USD',
    date: data.date,
    rates: {
      USD: 1,
      PLN: data.rates.PLN,
      EUR: data.rates.EUR,
    },
  };
}
