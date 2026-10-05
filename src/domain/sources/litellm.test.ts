import { describe, expect, it } from 'vitest';
import litellmFixture from '../../../scripts/__fixtures__/litellm-prices.json';
import openrouterFixture from '../../../scripts/__fixtures__/openrouter-models.json';
import type { ModelAlias } from '../types.js';
import { normalizeLiteLlm } from './litellm.js';
import { normalizeOpenRouter } from './openrouter.js';

describe('normalizeLiteLlm', () => {
  const { models } = normalizeOpenRouter(openrouterFixture);

  const aliases: ModelAlias[] = [
    {
      source: 'litellm',
      sourceId: 'custom-litellm-alias',
      modelId: 'openai/gpt-4o',
    },
  ];

  it('normalizes LiteLLM prices, matches models, filters mode and providers, and deduplicates', () => {
    const { offersByModelId, unmatched } = normalizeLiteLlm(litellmFixture, models, aliases);

    // 1. Matched offers present
    expect(offersByModelId.size).toBeGreaterThan(0);

    // 2. Check claude-sonnet-5.5 offers and longContext
    const sonnetOffers = offersByModelId.get('anthropic/claude-sonnet-5.5');
    expect(sonnetOffers).toBeDefined();
    expect(sonnetOffers?.length).toBe(1);
    const sonnetOffer = sonnetOffers?.[0];
    expect(sonnetOffer).toBeDefined();
    if (!sonnetOffer) return;

    expect(sonnetOffer.vendor).toBe('anthropic');
    expect(sonnetOffer.channel).toBe('direct');
    expect(sonnetOffer.inputPerMTok).toBe(3);
    expect(sonnetOffer.outputPerMTok).toBe(15);
    expect(sonnetOffer.cacheReadPerMTok).toBe(0.3);
    expect(sonnetOffer.cacheWritePerMTok).toBe(3.75);

    // Deduplication check: claude-3-5-sonnet-20241022 had long context above 200k tokens
    expect(sonnetOffer.longContext).toBeDefined();
    expect(sonnetOffer.longContext?.thresholdTokens).toBe(200000);
    expect(sonnetOffer.longContext?.inputPerMTok).toBe(6);

    // 3. Non-chat entries skipped
    expect(unmatched).not.toContain('text-embedding-3-small');

    // 4. Non-first-party provider entries skipped (bedrock)
    expect(unmatched).not.toContain('bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0');

    // 5. Unmatched eligible entries listed
    expect(unmatched).toContain('unknown-litellm-model');
    expect(unmatched).toEqual([...unmatched].sort());
  });

  it('throws descriptive error on non-record payload', () => {
    expect(() => normalizeLiteLlm([], models, [])).toThrow(/Invalid LiteLLM payload/);
  });
});
