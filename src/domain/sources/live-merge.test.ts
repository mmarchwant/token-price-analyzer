import { describe, expect, it } from 'vitest';
import { mergeLiveModels } from './live-merge';
import type { ModelEntry } from '../types';

function createDummyModel(overrides: Partial<ModelEntry> = {}): ModelEntry {
  return {
    id: 'vendor/model-1',
    name: 'Model 1',
    provider: 'vendor',
    providerName: 'Vendor',
    inputModalities: ['text'],
    outputModalities: ['text'],
    capabilities: {
      tools: true,
      reasoning: false,
      structuredOutputs: false,
      imageInput: false,
    },
    openWeights: false,
    offers: [
      {
        channel: 'openrouter',
        vendor: 'openrouter',
        sourceId: 'vendor/model-1',
        inputPerMTok: 1.0,
        outputPerMTok: 2.0,
        isFree: false,
      },
    ],
    quality: {
      source: 'none',
      tier: 'B',
    },
    ...overrides,
  };
}

describe('mergeLiveModels', () => {
  it('detects price changes and replaces openrouter offers while preserving direct offers', () => {
    const snapModel: ModelEntry = createDummyModel({
      id: 'vendor/model-1',
      offers: [
        {
          channel: 'direct',
          vendor: 'vendor',
          sourceId: 'vendor/model-1',
          inputPerMTok: 0.8,
          outputPerMTok: 1.8,
          isFree: false,
        },
        {
          channel: 'openrouter',
          vendor: 'openrouter',
          sourceId: 'vendor/model-1',
          inputPerMTok: 1.0,
          outputPerMTok: 2.0,
          isFree: false,
        },
      ],
    });

    const liveModel: ModelEntry = createDummyModel({
      id: 'vendor/model-1',
      offers: [
        {
          channel: 'openrouter',
          vendor: 'openrouter',
          sourceId: 'vendor/model-1',
          inputPerMTok: 1.2, // Changed price
          outputPerMTok: 2.0,
          isFree: false,
        },
      ],
    });

    const result = mergeLiveModels([snapModel], [liveModel]);

    expect(result.changedPriceIds.has('vendor/model-1')).toBe(true);
    expect(result.newModelIds.size).toBe(0);
    expect(result.models.length).toBe(1);

    const merged = result.models[0];
    expect(merged).toBeDefined();
    if (merged) {
      expect(merged.offers).toHaveLength(2);
      expect(merged.offers.find((o) => o.channel === 'direct')?.inputPerMTok).toBe(0.8);
      expect(merged.offers.find((o) => o.channel === 'openrouter')?.inputPerMTok).toBe(1.2);
    }
  });

  it('does not flag changedPriceIds when openrouter prices are identical', () => {
    const snapModel = createDummyModel({ id: 'vendor/model-1' });
    const liveModel = createDummyModel({ id: 'vendor/model-1' });

    const result = mergeLiveModels([snapModel], [liveModel]);

    expect(result.changedPriceIds.size).toBe(0);
  });

  it('updates quality to live openrouter-aa scores while preserving snapshot tier when snapshot source is none or openrouter-aa', () => {
    const snapModel = createDummyModel({
      id: 'vendor/model-1',
      quality: {
        source: 'none',
        tier: 'A',
      },
    });

    const liveModel = createDummyModel({
      id: 'vendor/model-1',
      quality: {
        source: 'openrouter-aa',
        intelligence: 85,
        coding: 90,
      },
    });

    const result = mergeLiveModels([snapModel], [liveModel]);
    const merged = result.models[0];
    expect(merged).toBeDefined();

    if (merged) {
      expect(merged.quality).toEqual({
        source: 'openrouter-aa',
        intelligence: 85,
        coding: 90,
        tier: 'A',
      });
    }
  });

  it('does not override quality scores when snapshot source is artificial-analysis or manual', () => {
    const snapModel = createDummyModel({
      id: 'vendor/model-1',
      quality: {
        source: 'artificial-analysis',
        intelligence: 95,
        tier: 'S',
      },
    });

    const liveModel = createDummyModel({
      id: 'vendor/model-1',
      quality: {
        source: 'openrouter-aa',
        intelligence: 85,
      },
    });

    const result = mergeLiveModels([snapModel], [liveModel]);
    const merged = result.models[0];
    expect(merged).toBeDefined();

    if (merged) {
      expect(merged.quality.source).toBe('artificial-analysis');
      expect(merged.quality.intelligence).toBe(95);
      expect(merged.quality.tier).toBe('S');
    }
  });

  it('appends live-only models, strips quality tier, and adds to newModelIds', () => {
    const snapModel = createDummyModel({ id: 'vendor/model-1' });
    const liveModelNew = createDummyModel({
      id: 'vendor/model-new',
      quality: {
        source: 'openrouter-aa',
        intelligence: 70,
        tier: 'B', // should be removed
      },
    });

    const result = mergeLiveModels([snapModel], [snapModel, liveModelNew]);

    expect(result.models).toHaveLength(2);
    expect(result.newModelIds.has('vendor/model-new')).toBe(true);

    const appended = result.models.find((m) => m.id === 'vendor/model-new');
    expect(appended?.quality.tier).toBeUndefined();
  });

  it('keeps snapshot-only models unchanged', () => {
    const snapModel1 = createDummyModel({ id: 'vendor/model-1' });
    const snapModel2 = createDummyModel({ id: 'vendor/model-2' });

    const result = mergeLiveModels([snapModel1, snapModel2], [snapModel1]);

    expect(result.models).toHaveLength(2);
    expect(result.models.map((m) => m.id)).toEqual(['vendor/model-1', 'vendor/model-2']);
  });
});
