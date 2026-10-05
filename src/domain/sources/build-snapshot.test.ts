import { describe, expect, it } from 'vitest';
import type { CuratedData, ModelEntry, PriceOffer, Snapshot } from '../types.js';
import { buildSnapshot } from './build-snapshot.js';

function createMockModel(overrides?: Partial<ModelEntry>): ModelEntry {
  return {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    providerName: 'OpenAI',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: {
      tools: true,
      reasoning: false,
      structuredOutputs: true,
      imageInput: false,
    },
    openWeights: false,
    offers: [
      {
        channel: 'openrouter',
        vendor: 'openrouter',
        sourceId: 'openai/gpt-4o',
        inputPerMTok: 2.5,
        outputPerMTok: 10,
        isFree: false,
      },
    ],
    quality: {
      intelligence: 90,
      source: 'openrouter-aa',
    },
    ...overrides,
  };
}

function createMockCurated(overrides?: Partial<CuratedData>): CuratedData {
  return {
    profiles: [],
    plans: [],
    fees: [],
    qualityOverrides: [],
    aliases: [],
    ...overrides,
  };
}

describe('buildSnapshot', () => {
  const fixedNow = new Date('2026-10-05T06:00:00Z');

  it('builds snapshot successfully with basic inputs', () => {
    const model = createMockModel();
    const curated = createMockCurated();

    const snapshot = buildSnapshot({
      now: fixedNow,
      openrouter: { models: [model], warnings: [] },
      curated,
      fx: { base: 'USD', date: '2026-10-05', rates: { USD: 1, PLN: 4.0, EUR: 0.9 } },
    });

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.generatedAt).toBe(fixedNow.toISOString());
    expect(snapshot.models.length).toBe(1);
    expect(snapshot.models[0]?.id).toBe('openai/gpt-4o');
    expect(snapshot.models[0]?.quality.tier).toBe('S');
  });

  it('merges LiteLLM direct offers into matching models', () => {
    const model = createMockModel();
    const curated = createMockCurated();

    const directOffer: PriceOffer = {
      channel: 'direct',
      vendor: 'openai',
      sourceId: 'gpt-4o',
      inputPerMTok: 2.5,
      outputPerMTok: 10,
      isFree: false,
    };

    const offersByModelId = new Map<string, PriceOffer[]>();
    offersByModelId.set('openai/gpt-4o', [directOffer]);

    const snapshot = buildSnapshot({
      now: fixedNow,
      openrouter: { models: [model], warnings: [] },
      litellm: { offersByModelId, unmatched: ['unmatched-litellm-1'] },
      curated,
    });

    expect(snapshot.models[0]?.offers.length).toBe(2);
    expect(snapshot.models[0]?.offers.some((o) => o.channel === 'direct')).toBe(true);
    expect(snapshot.diagnostics.unmatched).toContainEqual({
      source: 'litellm',
      ids: ['unmatched-litellm-1'],
    });
  });

  it('handles quality precedence and override behavior correctly', () => {
    const model1 = createMockModel({
      id: 'provider/m1',
      name: 'Model 1',
      provider: 'provider',
      quality: { intelligence: 80, source: 'openrouter-aa' },
    });
    const model2 = createMockModel({
      id: 'provider/m2',
      name: 'Model 2',
      provider: 'provider',
      quality: { source: 'none' },
    });

    const curated = createMockCurated({
      qualityOverrides: [
        {
          modelId: 'provider/m1',
          tier: 'A',
          coding: 95,
          force: true,
          note: { en: 'Forced override', pl: 'Forced override' },
        },
        {
          modelId: 'provider/m2',
          tier: 'B',
          intelligence: 70,
          force: false,
          note: { en: 'Non-forced override', pl: 'Non-forced override' },
        },
      ],
    });

    const aaByModelId = new Map();
    aaByModelId.set('provider/m1', {
      quality: { intelligence: 85, agentic: 88, source: 'artificial-analysis' },
      speed: { source: 'artificial-analysis', outputTokensPerSecond: 100 },
    });
    aaByModelId.set('provider/m2', {
      quality: { intelligence: 75, coding: 80, source: 'artificial-analysis' },
    });

    const snapshot = buildSnapshot({
      now: fixedNow,
      openrouter: { models: [model1, model2], warnings: [] },
      aa: { byModelId: aaByModelId, unmatched: [] },
      curated,
    });

    const m1 = snapshot.models.find((m) => m.id === 'provider/m1')!;
    expect(m1.quality.coding).toBe(95); // From forced override
    expect(m1.quality.intelligence).toBe(85); // Filled gap from AA direct
    expect(m1.quality.agentic).toBe(88); // Filled gap from AA direct
    expect(m1.quality.tier).toBe('A'); // Kept from override
    expect(m1.quality.source).toBe('manual');
    expect(m1.speed?.outputTokensPerSecond).toBe(100);

    const m2 = snapshot.models.find((m) => m.id === 'provider/m2')!;
    expect(m2.quality.intelligence).toBe(75); // AA direct takes precedence over non-forced override (70)
    expect(m2.quality.coding).toBe(80); // From AA direct
    expect(m2.quality.tier).toBe('B'); // Kept from override
    expect(m2.quality.source).toBe('artificial-analysis');
  });

  it('carries over models from previous snapshot on OpenRouter failure', () => {
    const prevModel = createMockModel({ id: 'previous/model' });
    const prevSnapshot: Snapshot = {
      schemaVersion: 1,
      generatedAt: '2026-10-04T00:00:00Z',
      sources: [],
      fx: { base: 'USD', date: '2026-10-04', rates: { USD: 1, PLN: 4.0, EUR: 0.9 } },
      models: [prevModel],
      subscriptions: [],
      usageProfiles: [],
      channelFees: [],
      diagnostics: { unmatched: [], warnings: [] },
    };

    const snapshot = buildSnapshot({
      now: fixedNow,
      openrouter: { error: 'Network Error' },
      previous: prevSnapshot,
      curated: createMockCurated(),
    });

    expect(snapshot.models.length).toBe(1);
    expect(snapshot.models[0]?.id).toBe('previous/model');
    expect(snapshot.diagnostics.warnings).toContain(
      'OpenRouter failed; models carried over from previous snapshot',
    );
  });

  it('throws when OpenRouter fails and no previous snapshot exists', () => {
    expect(() =>
      buildSnapshot({
        now: fixedNow,
        openrouter: { error: '500 Server Error' },
        curated: createMockCurated(),
      }),
    ).toThrow(/OpenRouter failed and no previous snapshot available/);
  });

  it('uses FX fallback rates when FX fetch fails and no previous snapshot', () => {
    const snapshot = buildSnapshot({
      now: fixedNow,
      openrouter: { models: [createMockModel()], warnings: [] },
      fx: { error: 'FX API offline' },
      curated: createMockCurated(),
    });

    expect(snapshot.fx.date).toBe('fallback');
    expect(snapshot.fx.rates.PLN).toBe(4.0);
    expect(snapshot.diagnostics.warnings).toContain(
      'FX fetch failed and no previous snapshot; using fallback rates',
    );
  });

  it('correctly records skipped AA source status', () => {
    const snapshot = buildSnapshot({
      now: fixedNow,
      openrouter: { models: [createMockModel()], warnings: [] },
      aa: 'skipped',
      curated: createMockCurated(),
    });

    const aaStatus = snapshot.sources.find((s) => s.id === 'artificial-analysis');
    expect(aaStatus?.skipped).toBe(true);
    expect(aaStatus?.ok).toBe(false);
  });

  it('drops models with zero offers', () => {
    const modelWithNoOffers = createMockModel({ id: 'no/offers', offers: [] });
    const modelWithOffer = createMockModel({ id: 'has/offer' });

    const snapshot = buildSnapshot({
      now: fixedNow,
      openrouter: { models: [modelWithNoOffers, modelWithOffer], warnings: [] },
      curated: createMockCurated(),
    });

    expect(snapshot.models.length).toBe(1);
    expect(snapshot.models[0]?.id).toBe('has/offer');
  });
});
