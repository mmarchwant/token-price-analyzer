import type { ModelAlias, ModelEntry, QualityScores, Speed } from '../types.js';
import { createModelMatcher } from './match.js';

export function normalizeArtificialAnalysis(
  pages: unknown[],
  models: ModelEntry[],
  aliases: ModelAlias[],
): {
  byModelId: Map<string, { quality: QualityScores; speed?: Speed }>;
  unmatched: string[];
} {
  if (!Array.isArray(pages)) {
    throw new Error('Invalid Artificial Analysis payload: expected array of pages');
  }

  const matcher = createModelMatcher(models, aliases, 'artificial-analysis');
  const byModelId = new Map<string, { quality: QualityScores; speed?: Speed }>();
  const unmatchedSet = new Set<string>();

  for (const page of pages) {
    if (typeof page !== 'object' || page === null) continue;
    const data = (page as Record<string, unknown>).data;
    if (!Array.isArray(data)) continue;

    for (const item of data) {
      if (typeof item !== 'object' || item === null) continue;

      const slug = item.slug;
      if (typeof slug !== 'string' || !slug) continue;

      const creatorName = item.model_creator?.name;
      const providerHint = typeof creatorName === 'string' ? creatorName : undefined;

      const modelId = matcher(slug, providerHint);

      if (!modelId) {
        unmatchedSet.add(slug);
        continue;
      }

      const evalObj = item.evaluations ?? {};
      const intel =
        typeof evalObj.artificial_analysis_intelligence_index === 'number'
          ? evalObj.artificial_analysis_intelligence_index
          : undefined;
      const coding =
        typeof evalObj.artificial_analysis_coding_index === 'number'
          ? evalObj.artificial_analysis_coding_index
          : undefined;
      const agentic =
        typeof evalObj.artificial_analysis_agentic_index === 'number'
          ? evalObj.artificial_analysis_agentic_index
          : undefined;

      const quality: QualityScores = {
        intelligence: intel,
        coding,
        agentic,
        source: 'artificial-analysis',
      };

      const perfObj = item.performance ?? {};
      const tps =
        typeof perfObj.median_output_tokens_per_second === 'number' &&
        perfObj.median_output_tokens_per_second > 0
          ? perfObj.median_output_tokens_per_second
          : undefined;
      const ttft =
        typeof perfObj.median_time_to_first_token_seconds === 'number' &&
        perfObj.median_time_to_first_token_seconds > 0
          ? perfObj.median_time_to_first_token_seconds
          : undefined;

      let speed: Speed | undefined = undefined;
      if (tps !== undefined || ttft !== undefined) {
        speed = {
          source: 'artificial-analysis',
          outputTokensPerSecond: tps,
          timeToFirstTokenSeconds: ttft,
        };
      }

      const existing = byModelId.get(modelId);
      if (!existing) {
        byModelId.set(modelId, { quality, speed });
      } else {
        const existingIntel = existing.quality.intelligence ?? 0;
        const newIntel = quality.intelligence ?? 0;
        if (newIntel > existingIntel) {
          byModelId.set(modelId, { quality, speed });
        }
      }
    }
  }

  const unmatched = Array.from(unmatchedSet).sort();

  return { byModelId, unmatched };
}
