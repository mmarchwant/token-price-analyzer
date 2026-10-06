import { describe, expect, it } from 'vitest';
import {
  apiEquivalentUsd,
  breakEvenTasks,
  capacityTasks,
  compareVerdict,
  coverage,
  leverage,
  limitSummary,
  monthlyUnits,
  planPrice,
  windowsPerDay,
} from './subscriptions';
import type { FxRates, ModelEntry, PriceOffer, SubscriptionPlan, UsageProfile } from './types';

const mockFx: FxRates = {
  base: 'USD',
  date: '2025-01-01',
  rates: {
    USD: 1,
    PLN: 4.0,
    EUR: 0.9,
  },
};

const mockOffer: PriceOffer = {
  channel: 'direct',
  vendor: 'anthropic',
  sourceId: 'test',
  inputPerMTok: 3.0, // $3 / 1M tokens
  outputPerMTok: 15.0, // $15 / 1M tokens
  isFree: false,
};

const mockProfile: UsageProfile = {
  id: 'test-profile',
  name: { en: 'Test Profile', pl: 'Testowy profil' },
  description: { en: 'Test', pl: 'Test' },
  inputTokensPerTask: 1000,
  outputTokensPerTask: 500,
  cachedInputShare: 0,
  tasksPerDay: 20,
  workDaysPerMonth: 20,
  qualityDimension: 'coding',
  allowBatch: false,
  isPreset: true,
};

// Task cost for mockProfile with mockOffer:
// (1000 * 3 + 500 * 15) / 1e6 = (3000 + 7500) / 1e6 = 10500 / 1e6 = $0.0105 per task

const mockModel: ModelEntry = {
  id: 'anthropic/claude-3.5-sonnet',
  name: 'Claude 3.5 Sonnet',
  provider: 'anthropic',
  providerName: 'Anthropic',
  inputModalities: ['text'],
  outputModalities: ['text'],
  capabilities: {
    tools: true,
    reasoning: true,
    structuredOutputs: true,
    imageInput: true,
  },
  openWeights: false,
  offers: [mockOffer],
  quality: {
    coding: 90,
    tier: 'S',
    source: 'manual',
  },
};

const basePlan: SubscriptionPlan = {
  id: 'claude-pro',
  provider: 'anthropic',
  providerName: 'Anthropic',
  name: 'Claude Pro',
  priceUsdMonthly: 20,
  url: 'https://anthropic.com',
  lastVerified: '2025-01-01',
  confidence: 'official',
  primaryModelId: 'anthropic/claude-3.5-sonnet',
  includedModelIds: ['anthropic/claude-3.5-sonnet'],
  features: {
    codingAgents: ['claude-code'],
    imageGeneration: false,
    deepResearch: false,
    apiAccess: false,
  },
  unitLabel: { en: 'messages', pl: 'wiadomości' },
  referenceUnit: {
    inputTokens: 1000,
    outputTokens: 500,
    cachedInputShare: 0,
  },
  notes: { en: 'Test note', pl: 'Notatka testowa' },
  sources: [{ label: 'Official', url: 'https://anthropic.com' }],
  limit: {
    kind: 'window',
    windowHours: 5,
    unitsPerWindow: { low: 45, high: 100 },
  },
};

describe('domain / subscriptions', () => {
  describe('windowsPerDay', () => {
    it('calculates and clamps windows per day correctly', () => {
      // 5-hour window, 8 active hours: Math.ceil(8/5) = 2 windows, max floor(24/5)=4 -> 2
      expect(windowsPerDay(5, 8)).toBe(2);

      // 5-hour window, 24 active hours: ceil(24/5)=5, max floor(24/5)=4 -> 4
      expect(windowsPerDay(5, 24)).toBe(4);

      // 5-hour window, 1 active hour: ceil(1/5)=1, max 4 -> 1
      expect(windowsPerDay(5, 1)).toBe(1);

      // 24-hour window, 8 active hours: ceil(8/24)=1, max 1 -> 1
      expect(windowsPerDay(24, 8)).toBe(1);

      // 0 or negative window hours returns fallback 1
      expect(windowsPerDay(0, 8)).toBe(1);
    });
  });

  describe('monthlyUnits', () => {
    it('calculates monthly units for window plan', () => {
      // windowHours = 5, activeHours = 8 -> windowsPD = 2
      // workDays = 20 -> total multiplier = 2 * 20 = 40
      // unitsPerWindow = { low: 45, high: 100 }
      // monthlyUnits = { low: 1800, high: 4000 }
      const res = monthlyUnits(basePlan, { activeHoursPerDay: 8, workDaysPerMonth: 20 });
      expect(res).toEqual({ low: 1800, high: 4000 });
    });

    it('applies weeklyUnitsCap when defined on window plan', () => {
      const planWithCap: SubscriptionPlan = {
        ...basePlan,
        limit: {
          kind: 'window',
          windowHours: 5,
          unitsPerWindow: { low: 45, high: 100 },
          weeklyUnitsCap: { low: 100, high: 200 },
        },
      };
      // base: low 1800, high 4000
      // weekly cap: low = 100 * 4.345 = 434.5, high = 200 * 4.345 = 869
      const res = monthlyUnits(planWithCap, { activeHoursPerDay: 8, workDaysPerMonth: 20 });
      expect(res).toEqual({ low: 434.5, high: 869 });
    });

    it('handles monthly limit kind', () => {
      const monthlyPlan: SubscriptionPlan = {
        ...basePlan,
        limit: {
          kind: 'monthly',
          unitsPerMonth: { low: 500, high: 1000 },
        },
      };
      const res = monthlyUnits(monthlyPlan, { activeHoursPerDay: 8, workDaysPerMonth: 20 });
      expect(res).toEqual({ low: 500, high: 1000 });
    });

    it('returns null for usd-credit and unknown limit kinds', () => {
      const creditPlan: SubscriptionPlan = {
        ...basePlan,
        limit: { kind: 'usd-credit', usdPerMonth: 20 },
      };
      const unknownPlan: SubscriptionPlan = {
        ...basePlan,
        limit: { kind: 'unknown' },
      };
      expect(monthlyUnits(creditPlan, { activeHoursPerDay: 8, workDaysPerMonth: 20 })).toBeNull();
      expect(monthlyUnits(unknownPlan, { activeHoursPerDay: 8, workDaysPerMonth: 20 })).toBeNull();
    });
  });

  describe('apiEquivalentUsd', () => {
    it('returns usdPerMonth for usd-credit plans', () => {
      const creditPlan: SubscriptionPlan = {
        ...basePlan,
        limit: { kind: 'usd-credit', usdPerMonth: 25 },
      };
      const res = apiEquivalentUsd(creditPlan, mockOffer, {
        activeHoursPerDay: 8,
        workDaysPerMonth: 20,
      });
      expect(res).toEqual({ low: 25, high: 25 });
    });

    it('computes unit cost multiplier for window/monthly plans', () => {
      // referenceUnit cost = (1000 * 3 + 500 * 15) / 1e6 = 0.0105
      // monthlyUnits = { low: 1800, high: 4000 }
      // apiEquivalentUsd = { low: 18.9, high: 42 }
      const res = apiEquivalentUsd(basePlan, mockOffer, {
        activeHoursPerDay: 8,
        workDaysPerMonth: 20,
      });
      expect(res?.low).toBeCloseTo(18.9);
      expect(res?.high).toBeCloseTo(42.0);
    });

    it('returns null if primaryOffer is missing', () => {
      expect(
        apiEquivalentUsd(basePlan, undefined, { activeHoursPerDay: 8, workDaysPerMonth: 20 }),
      ).toBeNull();
    });
  });

  describe('capacityTasks', () => {
    it('calculates floored capacity tasks for a profile', () => {
      // apiEq = { low: 18.9, high: 42.0 }
      // profile task cost = 0.0105
      // low = Math.floor(18.9 / 0.0105) = Math.floor(1800) = 1800
      // high = Math.floor(42.0 / 0.0105) = Math.floor(4000) = 4000
      const cap = capacityTasks(basePlan, mockProfile, mockOffer, {
        activeHoursPerDay: 8,
        workDaysPerMonth: 20,
      });
      expect(cap).toEqual({ low: 1800, high: 4000 });
    });

    it('returns null if offer is missing', () => {
      expect(
        capacityTasks(basePlan, mockProfile, undefined, {
          activeHoursPerDay: 8,
          workDaysPerMonth: 20,
        }),
      ).toBeNull();
    });
  });

  describe('coverage and leverage', () => {
    it('calculates coverage capped at 1.0', () => {
      // demand = 400 tasks
      // capacity = { low: 200, high: 800 }
      // low = 200 / 400 = 0.5, high = min(1, 800/400) = 1.0
      const cov = coverage({ low: 200, high: 800 }, 400);
      expect(cov).toEqual({ low: 0.5, high: 1.0 });
    });

    it('returns null coverage if capacity is null or demand <= 0', () => {
      expect(coverage(null, 400)).toBeNull();
      expect(coverage({ low: 100, high: 200 }, 0)).toBeNull();
    });

    it('calculates leverage', () => {
      // apiEq = { low: 40, high: 100 }, price = 20
      // leverage = { low: 2, high: 5 }
      const lev = leverage({ low: 40, high: 100 }, 20);
      expect(lev).toEqual({ low: 2, high: 5 });
    });

    it('returns null leverage if apiEquivalent is null or price <= 0', () => {
      expect(leverage(null, 20)).toBeNull();
      expect(leverage({ low: 40, high: 100 }, 0)).toBeNull();
    });
  });

  describe('breakEvenTasks', () => {
    it('calculates break even tasks count', () => {
      // price = 20, costPerTask = 0.0105 -> 20 / 0.0105 = 1904.7619...
      expect(breakEvenTasks(20, 0.0105)).toBeCloseTo(1904.76);
    });

    it('returns Infinity if cost per task is 0', () => {
      expect(breakEvenTasks(20, 0)).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe('planPrice', () => {
    it('uses local list price when available for currency', () => {
      const planWithLocal: SubscriptionPlan = {
        ...basePlan,
        localPrices: { PLN: 89, EUR: 22 },
      };
      const resPLN = planPrice(planWithLocal, 'PLN', mockFx, 23);
      expect(resPLN).toEqual({ amount: 89, isLocalList: true });
    });

    it('converts USD price and applies VAT when no local price exists', () => {
      // priceUsdMonthly = 20
      // PLN rate = 4.0 -> converted = 80
      // VAT 23% -> 80 * 1.23 = 98.4
      const resPLN = planPrice(basePlan, 'PLN', mockFx, 23);
      expect(resPLN.amount).toBeCloseTo(98.4);
      expect(resPLN.isLocalList).toBe(false);
    });
  });

  describe('limitSummary', () => {
    it('returns structured summary data for all limit kinds', () => {
      expect(limitSummary(basePlan)).toEqual({
        key: 'limit.window',
        params: { low: 45, high: 100, hours: 5 },
      });

      const planWithCap: SubscriptionPlan = {
        ...basePlan,
        limit: {
          kind: 'window',
          windowHours: 5,
          unitsPerWindow: { low: 45, high: 100 },
          weeklyUnitsCap: { low: 200, high: 400 },
        },
      };
      expect(limitSummary(planWithCap)).toEqual({
        key: 'limit.windowWithWeekly',
        params: { low: 45, high: 100, hours: 5, weeklyLow: 200, weeklyHigh: 400 },
      });

      const monthlyPlan: SubscriptionPlan = {
        ...basePlan,
        limit: { kind: 'monthly', unitsPerMonth: { low: 500, high: 1000 } },
      };
      expect(limitSummary(monthlyPlan)).toEqual({
        key: 'limit.monthly',
        params: { low: 500, high: 1000 },
      });

      const creditPlan: SubscriptionPlan = {
        ...basePlan,
        limit: { kind: 'usd-credit', usdPerMonth: 25 },
      };
      expect(limitSummary(creditPlan)).toEqual({
        key: 'limit.usdCredit',
        params: { amount: 25 },
      });

      const unknownPlan: SubscriptionPlan = {
        ...basePlan,
        limit: { kind: 'unknown' },
      };
      expect(limitSummary(unknownPlan)).toEqual({
        key: 'limit.unknown',
      });
    });
  });

  describe('compareVerdict', () => {
    it('returns subscription as winner when coverage is >= 0.9 and subscription is cheaper', () => {
      // demand = 400 tasks. taskCost = 0.0105 -> apiMonthlyCost = 400 * 0.0105 = $4.20
      // plan price = $3.00, plan coverage = { low: 0.95, high: 1.0 }
      const res = compareVerdict({
        plan: basePlan,
        planCoverage: { low: 0.95, high: 1.0 },
        planPriceUsd: 3.0,
        apiOffer: mockOffer,
        apiModel: mockModel,
        demandTasks: 400,
        profile: mockProfile,
      });

      expect(res.winner).toBe('subscription');
      expect(res.reasonKey).toBe('verdict.subscriptionWins');
      expect(res.savingsUsd).not.toBeNull();
    });

    it('returns api as winner when full API cost is cheaper than subscription price', () => {
      // demand = 100 tasks -> apiCost = 100 * 0.0105 = $1.05
      // plan price = $20.00
      const res = compareVerdict({
        plan: basePlan,
        planCoverage: { low: 0.2, high: 0.5 },
        planPriceUsd: 20.0,
        apiOffer: mockOffer,
        apiModel: mockModel,
        demandTasks: 100,
        profile: mockProfile,
      });

      expect(res.winner).toBe('api');
      expect(res.reasonKey).toBe('verdict.apiWins');
      expect(res.savingsUsd).toEqual({ low: 18.95, high: 18.95 });
    });

    it('returns unknown when planCoverage is null or offer is missing', () => {
      const res = compareVerdict({
        plan: basePlan,
        planCoverage: null,
        planPriceUsd: 20.0,
        apiOffer: mockOffer,
        apiModel: mockModel,
        demandTasks: 400,
        profile: mockProfile,
      });

      expect(res.winner).toBe('unknown');
    });
  });
});
