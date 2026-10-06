import { applyVat, convertFromUsd } from './currency';
import { costPerTask, taskFromProfile } from './pricing';
import { point, scaleRange } from './range';
import type {
  Currency,
  FxRates,
  ModelEntry,
  PriceOffer,
  Range,
  SubscriptionPlan,
  UsageProfile,
} from './types';

const EPSILON = 1e-9;

/**
 * Calculates windows per day based on active work hours and window duration.
 * Formula: clamp(ceil(activeHours / windowHours), 1, floor(24 / windowHours))
 */
export function windowsPerDay(windowHours: number, activeHoursPerDay: number): number {
  if (windowHours <= 0) {
    return 1;
  }
  const maxWindows = Math.floor(24 / windowHours);
  const neededWindows = Math.ceil(activeHoursPerDay / windowHours);
  return Math.min(Math.max(neededWindows, 1), Math.max(1, maxWindows));
}

/**
 * Calculates monthly reference units for a subscription plan given active work hours and work days.
 */
export function monthlyUnits(
  plan: SubscriptionPlan,
  ctx: { activeHoursPerDay: number; workDaysPerMonth: number },
): Range | null {
  const { limit } = plan;

  if (limit.kind === 'window') {
    const wpd = windowsPerDay(limit.windowHours, ctx.activeHoursPerDay);
    const multiplier = wpd * ctx.workDaysPerMonth;
    const base = scaleRange(limit.unitsPerWindow, multiplier);

    if (limit.weeklyUnitsCap) {
      const capLow = limit.weeklyUnitsCap.low * 4.345;
      const capHigh = limit.weeklyUnitsCap.high * 4.345;
      return {
        low: Math.min(base.low, capLow),
        high: Math.min(base.high, capHigh),
      };
    }

    return base;
  }

  if (limit.kind === 'monthly') {
    return limit.unitsPerMonth;
  }

  return null;
}

/**
 * Estimates the equivalent value in API USD for a plan.
 */
export function apiEquivalentUsd(
  plan: SubscriptionPlan,
  primaryOffer: PriceOffer | undefined,
  ctx: { activeHoursPerDay: number; workDaysPerMonth: number },
): Range | null {
  if (plan.limit.kind === 'usd-credit') {
    return point(plan.limit.usdPerMonth);
  }

  if (!primaryOffer) {
    return null;
  }

  const units = monthlyUnits(plan, ctx);
  if (!units) {
    return null;
  }

  const unitCost = costPerTask(plan.referenceUnit, primaryOffer);
  return scaleRange(units, unitCost);
}

/**
 * Estimates how many tasks of a given user profile the plan can handle.
 */
export function capacityTasks(
  plan: SubscriptionPlan,
  profile: UsageProfile,
  primaryOffer: PriceOffer | undefined,
  ctx: { activeHoursPerDay: number; workDaysPerMonth: number },
): Range | null {
  if (!primaryOffer) {
    return null;
  }

  const apiEq = apiEquivalentUsd(plan, primaryOffer, ctx);
  if (!apiEq) {
    return null;
  }

  const cProfile = costPerTask(taskFromProfile(profile), primaryOffer);
  if (cProfile === 0) {
    return null;
  }

  return {
    low: Math.floor(apiEq.low / cProfile + EPSILON),
    high: Math.floor(apiEq.high / cProfile + EPSILON),
  };
}

/**
 * Calculates coverage ratio (0..1) of plan capacity relative to demand tasks.
 */
export function coverage(capacity: Range | null, demandTasks: number): Range | null {
  if (!capacity || demandTasks <= 0) {
    return null;
  }

  return {
    low: Math.min(1, capacity.low / demandTasks),
    high: Math.min(1, capacity.high / demandTasks),
  };
}

/**
 * Calculates value leverage (multiplier on money spent) for the subscription.
 */
export function leverage(apiEquivalent: Range | null, priceUsd: number): Range | null {
  if (!apiEquivalent || priceUsd <= 0) {
    return null;
  }

  return {
    low: apiEquivalent.low / priceUsd,
    high: apiEquivalent.high / priceUsd,
  };
}

/**
 * Calculates the break-even task count where subscription price equals API usage cost.
 */
export function breakEvenTasks(priceUsd: number, costPerTaskUsd: number): number {
  if (costPerTaskUsd === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return priceUsd / costPerTaskUsd;
}

/**
 * Calculates display plan price in user currency, respecting local list prices if available.
 */
export function planPrice(
  plan: SubscriptionPlan,
  currency: Currency,
  fx: FxRates,
  vatRatePct: number,
): { amount: number; isLocalList: boolean } {
  if (plan.localPrices && currency in plan.localPrices) {
    const localVal = (plan.localPrices as Partial<Record<Currency, number>>)[currency];
    if (localVal !== undefined) {
      return {
        amount: localVal,
        isLocalList: true,
      };
    }
  }

  const converted = convertFromUsd(plan.priceUsdMonthly, currency, fx);
  return {
    amount: applyVat(converted, vatRatePct),
    isLocalList: false,
  };
}

/**
 * Generates structured data for i18n describing a plan's limit.
 */
export function limitSummary(plan: SubscriptionPlan): {
  key: string;
  params?: Record<string, unknown>;
} {
  const { limit } = plan;

  if (limit.kind === 'window') {
    if (limit.weeklyUnitsCap) {
      return {
        key: 'limit.windowWithWeekly',
        params: {
          low: limit.unitsPerWindow.low,
          high: limit.unitsPerWindow.high,
          hours: limit.windowHours,
          weeklyLow: limit.weeklyUnitsCap.low,
          weeklyHigh: limit.weeklyUnitsCap.high,
        },
      };
    }
    return {
      key: 'limit.window',
      params: {
        low: limit.unitsPerWindow.low,
        high: limit.unitsPerWindow.high,
        hours: limit.windowHours,
      },
    };
  }

  if (limit.kind === 'monthly') {
    return {
      key: 'limit.monthly',
      params: {
        low: limit.unitsPerMonth.low,
        high: limit.unitsPerMonth.high,
      },
    };
  }

  if (limit.kind === 'usd-credit') {
    return {
      key: 'limit.usdCredit',
      params: {
        amount: limit.usdPerMonth,
      },
    };
  }

  return {
    key: 'limit.unknown',
  };
}

export interface CompareVerdictInput {
  plan: SubscriptionPlan;
  planCoverage: Range | null;
  planPriceUsd: number;
  apiOffer: PriceOffer | undefined;
  apiModel: ModelEntry | undefined;
  demandTasks: number;
  profile: UsageProfile;
}

export interface CompareVerdictResult {
  winner: 'subscription' | 'api' | 'tie' | 'unknown';
  apiMonthlyCostUsd: number;
  savingsUsd: Range | null;
  reasonKey: string;
  params?: Record<string, unknown>;
}

/**
 * Decision rule for compareVerdict:
 * 1. Returns 'unknown' if plan's capacity/coverage is null, or if apiOffer is missing.
 * 2. Subscription wins when:
 *    a) Low coverage is >= 0.9 AND plan price < API cost for the full demand, OR
 *    b) API cost for the covered share of usage exceeds the plan price.
 * 3. API wins when the total API monthly cost for full demand is lower than the plan price.
 * 4. Returns 'tie' if API cost for full demand equals plan price or costs match.
 */
export function compareVerdict(input: CompareVerdictInput): CompareVerdictResult {
  const { planCoverage, planPriceUsd, apiOffer, apiModel, demandTasks, profile } = input;

  if (!planCoverage || !apiOffer || demandTasks <= 0) {
    return {
      winner: 'unknown',
      apiMonthlyCostUsd: 0,
      savingsUsd: null,
      reasonKey: 'verdict.unknown',
    };
  }

  const costPerTaskUsd = costPerTask(taskFromProfile(profile), apiOffer);
  const apiMonthlyCostUsd = demandTasks * costPerTaskUsd;

  const coveredLowTasks = planCoverage.low * demandTasks;
  const coveredHighTasks = planCoverage.high * demandTasks;
  const apiCostForLowCovered = coveredLowTasks * costPerTaskUsd;
  const apiCostForHighCovered = coveredHighTasks * costPerTaskUsd;

  const modelName = apiModel?.name ?? apiOffer.vendor;

  if (
    (planCoverage.low >= 0.9 && planPriceUsd < apiMonthlyCostUsd) ||
    apiCostForLowCovered > planPriceUsd
  ) {
    const lowSavings = Math.max(0, apiCostForLowCovered - planPriceUsd);
    const highSavings = Math.max(0, apiCostForHighCovered - planPriceUsd);
    return {
      winner: 'subscription',
      apiMonthlyCostUsd,
      savingsUsd: { low: lowSavings, high: highSavings },
      reasonKey: 'verdict.subscriptionWins',
      params: { modelName },
    };
  }

  if (apiMonthlyCostUsd < planPriceUsd) {
    const savings = planPriceUsd - apiMonthlyCostUsd;
    return {
      winner: 'api',
      apiMonthlyCostUsd,
      savingsUsd: { low: savings, high: savings },
      reasonKey: 'verdict.apiWins',
      params: { modelName },
    };
  }

  return {
    winner: 'tie',
    apiMonthlyCostUsd,
    savingsUsd: { low: 0, high: 0 },
    reasonKey: 'verdict.tie',
    params: { modelName },
  };
}
