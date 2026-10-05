import { describe, expect, it } from 'vitest';
import {
  assignTiers,
  meetsMinTier,
  paretoFrontier,
  qualityPerDollar,
  qualityScore,
  tierWeight,
} from './quality';
import type { ModelEntry } from './types';

describe('quality', () => {
  function makeModel(
    id: string,
    scores: { intelligence?: number; coding?: number; agentic?: number },
    tier?: 'S' | 'A' | 'B' | 'C' | 'D',
  ): ModelEntry {
    return {
      id,
      name: id,
      provider: 'test',
      providerName: 'Test',
      inputModalities: ['text'],
      outputModalities: ['text'],
      capabilities: { tools: true, reasoning: false, structuredOutputs: true, imageInput: false },
      openWeights: false,
      offers: [
        {
          channel: 'direct',
          vendor: 'test',
          sourceId: 'test',
          inputPerMTok: 1,
          outputPerMTok: 1,
          isFree: false,
        },
      ],
      quality: {
        ...scores,
        source: 'manual',
        tier,
      },
    };
  }

  it('gets qualityScore for dimension with fallback to intelligence', () => {
    const model = makeModel('m1', { intelligence: 80, coding: 90 });
    expect(qualityScore(model, 'coding')).toBe(90);
    expect(qualityScore(model, 'agentic')).toBe(80); // fallback to intelligence
  });

  it('assigns tiers using percentile ranking and handles unscored models with or without tier', () => {
    const m1 = makeModel('m1', { coding: 95 });
    const m2 = makeModel('m2', { coding: 85 });
    const m3 = makeModel('m3', { coding: 75 });
    const m4 = makeModel('m4', { coding: 65 });
    const mUnscoredTier = makeModel('mUnscored1', {}, 'C');
    const mUnscoredNoTier = makeModel('mUnscored2', {});

    const tiers = assignTiers([m1, m2, m3, m4, mUnscoredTier, mUnscoredNoTier], 'coding');

    // m1 is top model (rank 0/4) -> S
    expect(tiers.get('m1')).toBe('S');
    expect(tiers.get('mUnscored1')).toBe('C');
    expect(tiers.get('mUnscored2')).toBeUndefined();
  });

  it('assigns tiers across 20 models correctly', () => {
    const models: ModelEntry[] = [];
    for (let i = 0; i < 20; i++) {
      models.push(makeModel(`m${i}`, { intelligence: 100 - i }));
    }
    const tiers = assignTiers(models, 'intelligence');
    // Top 5% of 20 = index 0 (1 model) -> S
    expect(tiers.get('m0')).toBe('S');
    // Next 15% of 20 = indices 1..3 (3 models) -> A
    expect(tiers.get('m1')).toBe('A');
    expect(tiers.get('m3')).toBe('A');
    // Next 30% = indices 4..9 (6 models) -> B
    expect(tiers.get('m4')).toBe('B');
    expect(tiers.get('m9')).toBe('B');
    // Next 30% = indices 10..15 (6 models) -> C
    expect(tiers.get('m10')).toBe('C');
    expect(tiers.get('m15')).toBe('C');
    // Rest = indices 16..19 (4 models) -> D
    expect(tiers.get('m16')).toBe('D');
    expect(tiers.get('m19')).toBe('D');
  });

  it('returns tier weight', () => {
    expect(tierWeight('S')).toBe(1.0);
    expect(tierWeight('A')).toBe(0.85);
    expect(tierWeight('B')).toBe(0.7);
    expect(tierWeight('C')).toBe(0.55);
    expect(tierWeight('D')).toBe(0.4);
    expect(tierWeight(undefined)).toBe(0.5);
  });

  it('checks meetsMinTier', () => {
    expect(meetsMinTier('S', 'A')).toBe(true);
    expect(meetsMinTier('B', 'B')).toBe(true);
    expect(meetsMinTier('C', 'A')).toBe(false);

    // Unknown tier fails anything stricter than D
    expect(meetsMinTier(undefined, 'D')).toBe(true);
    expect(meetsMinTier(undefined, 'C')).toBe(false);
  });

  it('computes paretoFrontier correctly', () => {
    const points = [
      { id: 'p1', cost: 1.0, quality: 90 }, // Efficient: low cost, high quality
      { id: 'p2', cost: 0.5, quality: 70 }, // Efficient: very low cost
      { id: 'p3', cost: 2.0, quality: 95 }, // Efficient: higher cost, higher quality
      { id: 'p4', cost: 1.5, quality: 80 }, // Dominated by p1 (higher cost 1.5 > 1.0, lower quality 80 < 90)
      { id: 'p5', cost: 1.0, quality: 90 }, // Tie with p1 -> both kept
      { id: 'p6', cost: 1.0, quality: undefined }, // Excluded (no quality)
    ];

    const frontier = paretoFrontier(points);
    expect(frontier.has('p1')).toBe(true);
    expect(frontier.has('p2')).toBe(true);
    expect(frontier.has('p3')).toBe(true);
    expect(frontier.has('p4')).toBe(false);
    expect(frontier.has('p5')).toBe(true);
    expect(frontier.has('p6')).toBe(false);
  });

  it('calculates qualityPerDollar', () => {
    expect(qualityPerDollar(90, 2.0)).toBe(45);
    expect(qualityPerDollar(undefined, 2.0)).toBeNull();
    expect(qualityPerDollar(90, 0)).toBeNull();
  });
});
