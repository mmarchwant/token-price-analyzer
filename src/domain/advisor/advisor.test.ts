import { describe, expect, it } from 'vitest';
import snapshotJson from '../__fixtures__/built-snapshot.json';
import { parseSnapshot } from '../schemas';
import { advise, generateCandidates } from './engine';
import type { AdvisorInput, Needs } from './types';

const snapshot = parseSnapshot(snapshotJson);

const defaultNeeds: Needs = {
  codingAgent: false,
  imageGeneration: false,
  deepResearch: false,
  longContext: false,
  openWeights: false,
  toolCalling: false,
};

describe('Advisor Engine', () => {
  it('(a) $20 + coding-agent profile contains both api and subscription recommendations, sorted by score, stable across runs', () => {
    const codingProfile = snapshot.usageProfiles.find((p) => p.id === 'coding-agent')!;
    const input: AdvisorInput = {
      budgetUsd: 20,
      profile: codingProfile,
      intensity: 1.0,
      activeHoursPerDay: 8,
      needs: { ...defaultNeeds, codingAgent: true },
      minTier: 'any',
      includeFree: true,
      preferFlexibility: false,
    };

    const recs1 = advise(input, snapshot);
    const recs2 = advise(input, snapshot);

    expect(recs1).toBeDefined();
    expect(recs1.length).toBeGreaterThan(0);

    // Stable across runs
    expect(recs1).toEqual(recs2);

    // Contains both api and subscription strategy
    const hasApi = recs1.some((r) => r.strategy === 'api');
    const hasSub = recs1.some((r) => r.strategy === 'subscription');
    expect(hasApi).toBe(true);

    // Note: if $20 has subscription plans that meet codingAgent need (e.g. Cursor, ChatGPT Plus, etc.)
    expect(hasSub).toBe(true);

    // Check sorted by score descending (or equal score tie breaks)
    for (let i = 0; i < recs1.length - 2; i++) {
      expect(recs1[i]!.score).toBeGreaterThanOrEqual(recs1[i + 1]!.score);
    }
  });

  it('(b) $20 + chat-light profile gives coverage 1 for the top results', () => {
    const chatLight = snapshot.usageProfiles.find((p) => p.id === 'chat-light')!;
    const input: AdvisorInput = {
      budgetUsd: 20,
      profile: chatLight,
      intensity: 1.0,
      activeHoursPerDay: 8,
      needs: defaultNeeds,
      minTier: 'any',
      includeFree: true,
      preferFlexibility: false,
    };

    const recs = advise(input, snapshot);
    expect(recs.length).toBeGreaterThan(0);

    const topPick = recs[0]!;
    expect(topPick.coverage).not.toBeNull();
    expect(topPick.coverage?.low).toBeGreaterThanOrEqual(0.99);
  });

  it('(c) $0 + includeFree contains only free models or $0 cost options', () => {
    const chatLight = snapshot.usageProfiles.find((p) => p.id === 'chat-light')!;
    const input: AdvisorInput = {
      budgetUsd: 0,
      profile: chatLight,
      intensity: 1.0,
      activeHoursPerDay: 8,
      needs: defaultNeeds,
      minTier: 'any',
      includeFree: true,
      preferFlexibility: false,
    };

    const recs = advise(input, snapshot);
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.monthlyCostUsd).toBe(0);
    }
  });

  it('(d) openWeights need filters out closed-weight models and plans', () => {
    const chatLight = snapshot.usageProfiles.find((p) => p.id === 'chat-light')!;
    const input: AdvisorInput = {
      budgetUsd: 30,
      profile: chatLight,
      intensity: 1.0,
      activeHoursPerDay: 8,
      needs: { ...defaultNeeds, openWeights: true },
      minTier: 'any',
      includeFree: true,
      preferFlexibility: false,
    };

    const recs = advise(input, snapshot);
    for (const r of recs) {
      for (const mId of r.modelIds) {
        const model = snapshot.models.find((m) => m.id === mId);
        if (model) {
          expect(model.openWeights).toBe(true);
        }
      }
    }
  });

  it('(e) $40 budget evaluates at least one two-subscriptions or subscription+api candidate in generateCandidates', () => {
    const chatHeavy = snapshot.usageProfiles.find((p) => p.id === 'chat-heavy')!;
    const input: AdvisorInput = {
      budgetUsd: 40,
      profile: chatHeavy,
      intensity: 1.0,
      activeHoursPerDay: 8,
      needs: defaultNeeds,
      minTier: 'any',
      includeFree: true,
      preferFlexibility: false,
    };

    const candidates = generateCandidates(input, snapshot);
    const hasCombo = candidates.some(
      (c) => c.strategy === 'two-subscriptions' || c.strategy === 'subscription+api',
    );
    expect(hasCombo).toBe(true);
  });
});
