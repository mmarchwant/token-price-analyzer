import { describe, expect, it } from 'vitest';
import { buildBudgetRows, pickHighlights } from './budgetRows';
import type { ChannelFee, ModelEntry, UsageProfile } from '../../domain/types';

const sampleProfile: UsageProfile = {
  id: 'test-profile',
  name: { en: 'Test Profile', pl: 'Testowy' },
  description: { en: 'Desc', pl: 'Opis' },
  inputTokensPerTask: 1000,
  outputTokensPerTask: 200,
  cachedInputShare: 0,
  tasksPerDay: 50,
  workDaysPerMonth: 20,
  qualityDimension: 'intelligence',
  allowBatch: false,
  isPreset: true,
};

const sampleFees: ChannelFee[] = [
  {
    vendor: 'openrouter',
    purchaseFeePct: 5,
    minFeeUsd: 0.5,
    minTopUpUsd: 10,
    notes: { en: 'Note', pl: 'Uwaga' },
    sourceUrl: 'https://openrouter.ai',
    lastVerified: '2025-01-01',
  },
  {
    vendor: 'anthropic',
    purchaseFeePct: 0,
    minFeeUsd: 0,
    minTopUpUsd: 5,
    notes: { en: 'Note', pl: 'Uwaga' },
    sourceUrl: 'https://anthropic.com',
    lastVerified: '2025-01-01',
  },
];

const sampleModels: ModelEntry[] = [
  {
    id: 'model-a',
    name: 'Model A (Cheap)',
    provider: 'Provider A',
    providerName: 'Provider A',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: { tools: false, reasoning: false, structuredOutputs: false, imageInput: false },
    contextLength: 128000,
    maxOutputTokens: 4096,
    openWeights: false,
    quality: { intelligence: 80, tier: 'B', source: 'manual' },
    offers: [
      {
        channel: 'direct',
        vendor: 'vendor-a',
        sourceId: 'src-1',
        isFree: false,
        inputPerMTok: 0.1,
        outputPerMTok: 0.2,
      },
    ],
  },
  {
    id: 'model-b',
    name: 'Model B (High Quality)',
    provider: 'Provider B',
    providerName: 'Provider B',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: { tools: false, reasoning: false, structuredOutputs: false, imageInput: false },
    contextLength: 128000,
    maxOutputTokens: 4096,
    openWeights: false,
    quality: { intelligence: 95, tier: 'S', source: 'manual' },
    offers: [
      {
        channel: 'openrouter',
        vendor: 'openrouter',
        sourceId: 'src-2',
        isFree: false,
        inputPerMTok: 10.0,
        outputPerMTok: 30.0,
      },
    ],
  },
  {
    id: 'model-free',
    name: 'Free Model',
    provider: 'Provider Free',
    providerName: 'Provider Free',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: { tools: false, reasoning: false, structuredOutputs: false, imageInput: false },
    contextLength: 32000,
    maxOutputTokens: 2048,
    openWeights: true,
    quality: { intelligence: 60, tier: 'D', source: 'manual' },
    offers: [
      {
        channel: 'openrouter-free',
        vendor: 'openrouter',
        sourceId: 'src-3',
        isFree: true,
        inputPerMTok: 0,
        outputPerMTok: 0,
      },
    ],
  },
];

describe('buildBudgetRows', () => {
  it('calculates credit, tasks, workDays and fees correctly when fees are applied', () => {
    const rows = buildBudgetRows({
      models: sampleModels,
      profile: sampleProfile,
      budgetUsd: 20,
      fees: sampleFees,
      includeFree: true,
      includeBatch: false,
      applyFees: true,
    });

    expect(rows.length).toBe(3);

    const modelBRow = rows.find((r) => r.model.id === 'model-b');
    expect(modelBRow).toBeDefined();
    // OpenRouter fee for $20: fee is max(20 * 0.05 = $1, $0.5) = $1 => credit = $19
    expect(modelBRow?.credit).toBe(19);
    expect(modelBRow?.belowMinTopUp).toBe(false);

    const modelARow = rows.find((r) => r.model.id === 'model-a');
    expect(modelARow).toBeDefined();
    // No fee for vendor-a in sampleFees => credit = $20
    expect(modelARow?.credit).toBe(20);
  });

  it('flags belowMinTopUp when budget is below min top-up', () => {
    const rows = buildBudgetRows({
      models: sampleModels,
      profile: sampleProfile,
      budgetUsd: 5, // OpenRouter min top-up is $10
      fees: sampleFees,
      includeFree: true,
      includeBatch: false,
      applyFees: true,
    });

    const modelBRow = rows.find((r) => r.model.id === 'model-b');
    expect(modelBRow).toBeDefined();
    expect(modelBRow?.belowMinTopUp).toBe(true);
    expect(modelBRow?.credit).toBe(0);
  });

  it('ignores fees when applyFees is false', () => {
    const rows = buildBudgetRows({
      models: sampleModels,
      profile: sampleProfile,
      budgetUsd: 5,
      fees: sampleFees,
      includeFree: true,
      includeBatch: false,
      applyFees: false,
    });

    const modelBRow = rows.find((r) => r.model.id === 'model-b');
    expect(modelBRow).toBeDefined();
    expect(modelBRow?.belowMinTopUp).toBe(false);
    expect(modelBRow?.credit).toBe(5);
  });

  it('handles free models correctly with Infinity tasks/days and rateLimited flag', () => {
    const rows = buildBudgetRows({
      models: sampleModels,
      profile: sampleProfile,
      budgetUsd: 20,
      fees: sampleFees,
      includeFree: true,
      includeBatch: false,
      applyFees: true,
    });

    const freeRow = rows.find((r) => r.model.id === 'model-free');
    expect(freeRow).toBeDefined();
    expect(freeRow?.isFree).toBe(true);
    expect(freeRow?.rateLimited).toBe(true);
    expect(freeRow?.tasks).toBe(Number.POSITIVE_INFINITY);
    expect(freeRow?.workDays).toBe(Number.POSITIVE_INFINITY);
    expect(freeRow?.coverageOfMonth).toBe(1);
  });

  it('only includes models scored for the active profile dimension', () => {
    const rows = buildBudgetRows({
      models: [
        sampleModels[0]!,
        {
          ...sampleModels[1]!,
          id: 'coding-model',
          quality: { intelligence: 40, coding: 91, tier: 'A', source: 'manual' },
        },
      ],
      profile: { ...sampleProfile, qualityDimension: 'coding' },
      budgetUsd: 20,
      fees: sampleFees,
      includeFree: false,
      includeBatch: false,
      applyFees: true,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.model.id).toBe('coding-model');
    expect(rows[0]?.quality).toBe(91);
  });
});

describe('pickHighlights', () => {
  it('picks bestQualityFullMonth, cheapestAcceptable, and bestValue correctly', () => {
    const rows = buildBudgetRows({
      models: sampleModels,
      profile: sampleProfile,
      budgetUsd: 20,
      fees: sampleFees,
      includeFree: true,
      includeBatch: false,
      applyFees: true,
    });

    const highlights = pickHighlights(rows, 'B');

    expect(highlights.bestQualityFullMonth?.model.id).toBe('model-b');
    expect(highlights.cheapestAcceptable?.model.id).toBe('model-a');
    expect(highlights.bestValue?.model.id).toBe('model-b');
  });

  it('returns empty results for empty rows', () => {
    const highlights = pickHighlights([], 'B');
    expect(highlights.bestQualityFullMonth).toBeUndefined();
    expect(highlights.cheapestAcceptable).toBeUndefined();
    expect(highlights.bestValue).toBeUndefined();
  });
});
