import { describe, expect, it } from 'vitest';
import page1 from '../../../scripts/__fixtures__/aa-models-page1.json';
import page2 from '../../../scripts/__fixtures__/aa-models-page2.json';
import openrouterFixture from '../../../scripts/__fixtures__/openrouter-models.json';
import { normalizeArtificialAnalysis } from './artificial-analysis.js';
import { normalizeOpenRouter } from './openrouter.js';

describe('normalizeArtificialAnalysis', () => {
  const { models } = normalizeOpenRouter(openrouterFixture);

  it('normalizes AA multi-page payloads, matches models, parses speed/quality, resolves duplicates, and lists unmatched', () => {
    const { byModelId, unmatched } = normalizeArtificialAnalysis([page1, page2], models, []);

    // 1. Matched entries present
    expect(byModelId.size).toBeGreaterThan(0);

    // 2. Check claude-sonnet-5.5 quality and speed
    const sonnet = byModelId.get('anthropic/claude-sonnet-5.5');
    expect(sonnet).toBeDefined();
    expect(sonnet?.quality.source).toBe('artificial-analysis');
    expect(sonnet?.quality.intelligence).toBe(88.0);
    expect(sonnet?.quality.coding).toBe(92.5);

    expect(sonnet?.speed).toBeDefined();
    expect(sonnet?.speed?.source).toBe('artificial-analysis');
    expect(sonnet?.speed?.outputTokensPerSecond).toBe(65.4);
    expect(sonnet?.speed?.timeToFirstTokenSeconds).toBe(0.45);

    // 3. Duplicate resolution: page1 had intelligence 88.0, page2 duplicate had 80.0. Higher (88.0) was retained.
    expect(sonnet?.quality.intelligence).toBe(88.0);

    // 4. Unmatched slugs collected across pages
    expect(unmatched).toContain('unmatched-model-1');
    expect(unmatched).toContain('unmatched-model-2');
    expect(unmatched).toEqual([...unmatched].sort());
  });

  it('throws descriptive error on invalid payload', () => {
    expect(() => normalizeArtificialAnalysis({} as unknown[], models, [])).toThrow(
      /Invalid Artificial Analysis payload/,
    );
  });
});
