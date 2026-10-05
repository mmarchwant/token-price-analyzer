import { describe, expect, it } from 'vitest';
import {
  costPerTask,
  effectivePerMTok,
  effectivePrices,
  generationSecondsPerTask,
  monthlyCost,
  monthlyTasks,
  selectOffer,
  taskFromProfile,
  tasksForBudget,
  tokensForBudget,
  usableCredit,
  workDaysForBudget,
} from './pricing';
import type { ChannelFee, ModelEntry, PriceOffer, UsageProfile } from './types';

describe('pricing', () => {
  const baseOffer: PriceOffer = {
    channel: 'direct',
    vendor: 'anthropic',
    sourceId: 'litellm',
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
    cacheReadPerMTok: 0.3,
    cacheWritePerMTok: 3.75,
    isFree: false,
  };

  const longContextOffer: PriceOffer = {
    channel: 'direct',
    vendor: 'google',
    sourceId: 'litellm',
    inputPerMTok: 1.25,
    outputPerMTok: 5.0,
    isFree: false,
    longContext: {
      thresholdTokens: 10000,
      inputPerMTok: 2.5,
      outputPerMTok: 10.0,
      cacheReadPerMTok: 0.6,
    },
  };

  const freeOffer: PriceOffer = {
    channel: 'openrouter-free',
    vendor: 'openrouter',
    sourceId: 'openrouter',
    inputPerMTok: 0,
    outputPerMTok: 0,
    isFree: true,
  };

  it('calculates effectivePrices considering longContext threshold', () => {
    expect(effectivePrices(longContextOffer, 5000)).toEqual({
      inputPerMTok: 1.25,
      outputPerMTok: 5.0,
      cacheReadPerMTok: undefined,
      cacheWritePerMTok: undefined,
    });

    expect(effectivePrices(longContextOffer, 15000)).toEqual({
      inputPerMTok: 2.5,
      outputPerMTok: 10.0,
      cacheReadPerMTok: 0.6,
      cacheWritePerMTok: undefined,
    });
  });

  it('calculates costPerTask with zero cache and 100% cache', () => {
    const task0Cache = { inputTokens: 1000000, outputTokens: 1000000, cachedInputShare: 0 };
    // 1M * 3.0 + 1M * 15.0 = 18 USD
    expect(costPerTask(task0Cache, baseOffer)).toBeCloseTo(18.0);

    const task100Cache = { inputTokens: 1000000, outputTokens: 1000000, cachedInputShare: 1.0 };
    // 1M * 0.3 + 1M * 15.0 = 15.3 USD
    expect(costPerTask(task100Cache, baseOffer)).toBeCloseTo(15.3);
  });

  it('calculates costPerTask with partial cache and chargeCacheWrites toggle', () => {
    const task50Cache = { inputTokens: 1000000, outputTokens: 0, cachedInputShare: 0.5 };
    // 500k cached @ 0.3 = 0.15
    // 500k uncached @ 3.75 (cache write price) = 1.875
    // Total = 2.025
    expect(costPerTask(task50Cache, baseOffer, { chargeCacheWrites: true })).toBeCloseTo(2.025);

    // With chargeCacheWrites off: 500k uncached @ 3.0 (input price) = 1.5
    // Total = 1.65
    expect(costPerTask(task50Cache, baseOffer, { chargeCacheWrites: false })).toBeCloseTo(1.65);
  });

  it('handles missing cacheReadPerMTok by falling back to inputPerMTok', () => {
    const offerNoCachePrice: PriceOffer = {
      channel: 'direct',
      vendor: 'openai',
      sourceId: 'litellm',
      inputPerMTok: 2.5,
      outputPerMTok: 10.0,
      isFree: false,
    };
    const task = { inputTokens: 1000000, outputTokens: 0, cachedInputShare: 0.5 };
    // 500k @ 2.5 + 500k @ 2.5 = 2.5 USD
    expect(costPerTask(task, offerNoCachePrice)).toBeCloseTo(2.5);
  });

  it('returns 0 for free offers', () => {
    const task = { inputTokens: 100000, outputTokens: 100000, cachedInputShare: 0.5 };
    expect(costPerTask(task, freeOffer)).toBe(0);
  });

  it('calculates effectivePerMTok', () => {
    const task = { inputTokens: 1000, outputTokens: 1000, cachedInputShare: 0 };
    const cost = costPerTask(task, baseOffer);
    expect(effectivePerMTok(task, baseOffer)).toBeCloseTo((cost / 2000) * 1e6);

    const emptyTask = { inputTokens: 0, outputTokens: 0, cachedInputShare: 0 };
    expect(effectivePerMTok(emptyTask, baseOffer)).toBe(0);
  });

  it('calculates profile-based metrics', () => {
    const profile: UsageProfile = {
      id: 'test-profile',
      name: { en: 'Test', pl: 'Test' },
      description: { en: 'Test', pl: 'Test' },
      inputTokensPerTask: 1000,
      outputTokensPerTask: 500,
      cachedInputShare: 0,
      tasksPerDay: 10,
      workDaysPerMonth: 20,
      qualityDimension: 'coding',
      allowBatch: false,
      isPreset: true,
    };

    const task = taskFromProfile(profile);
    expect(task).toEqual({ inputTokens: 1000, outputTokens: 500, cachedInputShare: 0 });

    expect(monthlyTasks(profile)).toBe(200);

    const singleCost = costPerTask(task, baseOffer);
    expect(monthlyCost(profile, baseOffer)).toBeCloseTo(singleCost * 200);
  });

  it('calculates budget metrics', () => {
    const task = { inputTokens: 1000, outputTokens: 1000, cachedInputShare: 0 };

    expect(tasksForBudget(1.8, task, baseOffer)).toBe(100);
    expect(tasksForBudget(10, task, freeOffer)).toBe(Number.POSITIVE_INFINITY);

    const profile: UsageProfile = {
      id: 'test-profile',
      name: { en: 'Test', pl: 'Test' },
      description: { en: 'Test', pl: 'Test' },
      inputTokensPerTask: 1000,
      outputTokensPerTask: 1000,
      cachedInputShare: 0,
      tasksPerDay: 10,
      workDaysPerMonth: 20,
      qualityDimension: 'intelligence',
      allowBatch: false,
      isPreset: true,
    };

    // daily cost = 10 * 0.018 = 0.18 USD
    expect(workDaysForBudget(1.8, profile, baseOffer)).toBeCloseTo(10);
    expect(workDaysForBudget(10, profile, freeOffer)).toBe(Number.POSITIVE_INFINITY);

    const resultTokens = tokensForBudget(1.8, task, baseOffer);
    expect(resultTokens.inputTokens).toBeCloseTo(100000);
    expect(resultTokens.outputTokens).toBeCloseTo(100000);

    expect(tokensForBudget(10, task, freeOffer)).toEqual({
      inputTokens: Number.POSITIVE_INFINITY,
      outputTokens: Number.POSITIVE_INFINITY,
    });
  });

  it('calculates generationSecondsPerTask', () => {
    const task = { inputTokens: 1000, outputTokens: 100, cachedInputShare: 0 };
    expect(
      generationSecondsPerTask(task, {
        outputTokensPerSecond: 50,
        timeToFirstTokenSeconds: 0.5,
        source: 'test',
      }),
    ).toBeCloseTo(2.5);

    expect(generationSecondsPerTask(task, undefined)).toBeNull();
    expect(
      generationSecondsPerTask(task, {
        outputTokensPerSecond: 0,
        timeToFirstTokenSeconds: 0.5,
        source: 'test',
      }),
    ).toBeNull();
  });

  it('selects cheapest eligible offer and breaks ties preferring direct over openrouter', () => {
    const openrouterOffer: PriceOffer = {
      channel: 'openrouter',
      vendor: 'openrouter',
      sourceId: 'openrouter',
      inputPerMTok: 3.0,
      outputPerMTok: 15.0,
      isFree: false,
    };

    const batchOffer: PriceOffer = {
      channel: 'openrouter-batch',
      vendor: 'openrouter',
      sourceId: 'openrouter',
      inputPerMTok: 1.0,
      outputPerMTok: 5.0,
      isFree: false,
    };

    const model: ModelEntry = {
      id: 'test/model',
      name: 'Test Model',
      provider: 'test',
      providerName: 'Test Provider',
      inputModalities: ['text'],
      outputModalities: ['text'],
      capabilities: { tools: true, reasoning: false, structuredOutputs: true, imageInput: false },
      openWeights: false,
      offers: [openrouterOffer, baseOffer, freeOffer, batchOffer],
      quality: { source: 'none' },
    };

    const task = { inputTokens: 1000, outputTokens: 1000, cachedInputShare: 0 };

    // With free allowed -> free offer
    expect(selectOffer(model, task, { includeFree: true, includeBatch: false })?.channel).toBe(
      'openrouter-free',
    );

    // Without free, with batch allowed -> batch offer (cheapest)
    expect(selectOffer(model, task, { includeFree: false, includeBatch: true })?.channel).toBe(
      'openrouter-batch',
    );

    // Without free, without batch -> baseOffer (direct) ties with openrouterOffer, prefers direct
    const selected = selectOffer(model, task, { includeFree: false, includeBatch: false });
    expect(selected?.channel).toBe('direct');
  });

  it('returns undefined when selectOffer has no eligible offers', () => {
    const model: ModelEntry = {
      id: 'free/model',
      name: 'Free Model',
      provider: 'free',
      providerName: 'Free',
      inputModalities: ['text'],
      outputModalities: ['text'],
      capabilities: { tools: false, reasoning: false, structuredOutputs: false, imageInput: false },
      openWeights: true,
      offers: [freeOffer],
      quality: { source: 'none' },
    };
    const task = { inputTokens: 1000, outputTokens: 1000, cachedInputShare: 0 };
    expect(selectOffer(model, task, { includeFree: false, includeBatch: false })).toBeUndefined();
  });

  it('calculates usableCredit considering channel fee and topUp minimums', () => {
    expect(usableCredit(100)).toBe(100);

    const fee: ChannelFee = {
      vendor: 'reseller',
      purchaseFeePct: 5.0,
      minFeeUsd: 1.0,
      minTopUpUsd: 20.0,
      notes: { en: 'Fee', pl: 'Opłata' },
      sourceUrl: 'https://example.com',
      lastVerified: '2025-01-01',
    };

    // Budget below minTopUp -> 0
    expect(usableCredit(10, fee)).toBe(0);

    // Budget 20: 5% of 20 = 1.0 USD, minFee = 1.0 USD -> fee = 1.0 -> usable = 19
    expect(usableCredit(20, fee)).toBe(19);

    // Budget 100: 5% of 100 = 5.0 USD > minFee 1.0 -> fee = 5.0 -> usable = 95
    expect(usableCredit(100, fee)).toBe(95);
  });
});
