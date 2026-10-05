import { describe, expect, it } from 'vitest';
import openrouterFixture from '../../../scripts/__fixtures__/openrouter-models.json';
import { ModelEntrySchema } from '../schemas.js';
import { normalizeOpenRouter } from './openrouter.js';

describe('normalizeOpenRouter', () => {
  it('normalizes OpenRouter models correctly and validates against ModelEntrySchema', () => {
    const { models, warnings } = normalizeOpenRouter(openrouterFixture);

    expect(models.length).toBeGreaterThan(0);

    // Every produced model must pass ModelEntrySchema
    for (const model of models) {
      const parseResult = ModelEntrySchema.safeParse(model);
      expect(
        parseResult.success,
        `Model ${model.id} failed schema validation: ${parseResult.error?.message}`,
      ).toBe(true);
    }

    // 1. Check alias skip (~ entries skipped)
    expect(models.some((m) => m.id.startsWith('~'))).toBe(false);

    // 2. Check negative price skip (router auto skipped)
    expect(models.some((m) => m.id === 'openrouter/auto')).toBe(false);

    // 3. Check variant grouping for gpt-3.5-turbo (:free and :batch variants merged)
    const gpt35 = models.find((m) => m.id === 'openai/gpt-3.5-turbo');
    expect(gpt35).toBeDefined();
    expect(gpt35?.offers.length).toBe(3); // base + free + batch
    expect(gpt35?.offers.map((o) => o.channel)).toEqual([
      'openrouter',
      'openrouter-free',
      'openrouter-batch',
    ]);

    // 4. Check free-only model creation (gemma-2-9b-it:free -> gemma-2-9b-it)
    const gemma = models.find((m) => m.id === 'google/gemma-2-9b-it');
    expect(gemma).toBeDefined();
    expect(gemma?.offers.length).toBe(1);
    expect(gemma?.offers[0]?.channel).toBe('openrouter-free');
    expect(gemma?.offers[0]?.isFree).toBe(true);

    // 5. Check long context override mapping
    const claudeSonnet = models.find((m) => m.id === 'anthropic/claude-sonnet-5.5');
    expect(claudeSonnet).toBeDefined();
    const sonnetOffer = claudeSonnet?.offers[0];
    expect(sonnetOffer?.longContext).toBeDefined();
    expect(sonnetOffer?.longContext?.thresholdTokens).toBe(128000);
    expect(sonnetOffer?.longContext?.inputPerMTok).toBe(6);
    expect(sonnetOffer?.longContext?.outputPerMTok).toBe(24);

    // 6. Check time-window overrides warning count
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toMatch(/Ignored 1 time-window override/);

    // 7. Check capability flags and openWeights
    const llama = models.find((m) => m.id === 'meta-llama/llama-3.3-70b-instruct');
    expect(llama?.openWeights).toBe(true);

    const gpt4o = models.find((m) => m.id === 'openai/gpt-4o');
    expect(gpt4o?.capabilities.tools).toBe(true);
    expect(gpt4o?.capabilities.structuredOutputs).toBe(true);
    expect(gpt4o?.capabilities.imageInput).toBe(true);
    expect(gpt4o?.openWeights).toBeNull();

    // 8. Check benchmark quality fields
    expect(claudeSonnet?.quality.source).toBe('openrouter-aa');
    expect(claudeSonnet?.quality.intelligence).toBe(88.0);

    const qwen = models.find((m) => m.id === 'qwen/qwen-2.5-coder-32b-instruct');
    expect(qwen?.quality.source).toBe('none');

    // 9. Check sorting by provider, then name
    for (let i = 1; i < models.length; i++) {
      const prev = models[i - 1];
      const curr = models[i];
      if (!prev || !curr) continue;
      const provCmp = prev.provider.localeCompare(curr.provider);
      if (provCmp === 0) {
        expect(prev.name.localeCompare(curr.name)).toBeLessThanOrEqual(0);
      } else {
        expect(provCmp).toBeLessThan(0);
      }
    }
  });

  it('throws descriptive error on invalid top-level shape', () => {
    expect(() => normalizeOpenRouter({ invalid: true })).toThrow(/Invalid OpenRouter payload/);
  });
});
