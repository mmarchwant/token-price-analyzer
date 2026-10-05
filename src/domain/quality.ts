import type { ModelEntry, QualityDimension, QualityTier } from './types';

const TIER_ORDER: Record<QualityTier, number> = {
  S: 4,
  A: 3,
  B: 2,
  C: 1,
  D: 0,
};

export function qualityScore(model: ModelEntry, dimension: QualityDimension): number | undefined {
  return model.quality[dimension] ?? model.quality.intelligence;
}

export function assignTiers(
  models: ModelEntry[],
  dimension: QualityDimension,
): Map<string, QualityTier> {
  const result = new Map<string, QualityTier>();

  const scoredModels: { id: string; score: number }[] = [];
  const unscoredModels: ModelEntry[] = [];

  for (const model of models) {
    const score = qualityScore(model, dimension);
    if (score !== undefined) {
      scoredModels.push({ id: model.id, score });
    } else {
      unscoredModels.push(model);
    }
  }

  // Sort scored models by score descending, then by id ascending for stability
  scoredModels.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.id.localeCompare(b.id);
  });

  const N = scoredModels.length;

  for (let i = 0; i < N; i++) {
    const { id } = scoredModels[i]!;
    let tier: QualityTier;

    if (i === 0) {
      tier = 'S';
    } else {
      const frac = i / N;
      if (frac < 0.05) {
        tier = 'S';
      } else if (frac < 0.2) {
        tier = 'A';
      } else if (frac < 0.5) {
        tier = 'B';
      } else if (frac < 0.8) {
        tier = 'C';
      } else {
        tier = 'D';
      }
    }

    result.set(id, tier);
  }

  for (const model of unscoredModels) {
    if (model.quality.tier) {
      result.set(model.id, model.quality.tier);
    }
  }

  return result;
}

export function tierWeight(tier?: QualityTier): number {
  switch (tier) {
    case 'S':
      return 1.0;
    case 'A':
      return 0.85;
    case 'B':
      return 0.7;
    case 'C':
      return 0.55;
    case 'D':
      return 0.4;
    default:
      return 0.5;
  }
}

export function meetsMinTier(tier: QualityTier | undefined, minTier: QualityTier): boolean {
  if (tier === undefined) {
    return minTier === 'D';
  }
  return TIER_ORDER[tier] >= TIER_ORDER[minTier];
}

export function paretoFrontier(
  points: { id: string; cost: number; quality: number | undefined }[],
): Set<string> {
  const validPoints = points.filter(
    (p): p is { id: string; cost: number; quality: number } => p.quality !== undefined,
  );

  const frontier = new Set<string>();

  for (const p of validPoints) {
    let dominated = false;
    for (const other of validPoints) {
      if (other.id === p.id) continue;
      const costBetterOrEqual = other.cost <= p.cost;
      const qualityBetterOrEqual = other.quality >= p.quality;
      const strictlyBetter = other.cost < p.cost || other.quality > p.quality;

      if (costBetterOrEqual && qualityBetterOrEqual && strictlyBetter) {
        dominated = true;
        break;
      }
    }
    if (!dominated) {
      frontier.add(p.id);
    }
  }

  return frontier;
}

export function qualityPerDollar(
  quality: number | undefined,
  costPerTaskUsd: number,
): number | null {
  if (quality === undefined || costPerTaskUsd === 0) {
    return null;
  }
  return quality / costPerTaskUsd;
}
