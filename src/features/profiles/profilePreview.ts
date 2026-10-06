import { assignTiers, meetsMinTier, paretoFrontier, qualityScore } from '../../domain/quality';
import { costPerTask, monthlyTasks, selectOffer, taskFromProfile } from '../../domain/pricing';
import type { ModelEntry, PriceOffer, QualityTier, UsageProfile } from '../../domain/types';

export interface ReferenceModelEntry {
  model: ModelEntry;
  offer: PriceOffer;
  costPerTaskUsd: number;
  monthlyCostUsd: number;
  qualityScore?: number;
  tier?: QualityTier;
}

export interface ReferenceModelsResult {
  bestQuality?: ReferenceModelEntry;
  bestValue?: ReferenceModelEntry;
  cheapestPaid?: ReferenceModelEntry;
}

export interface ReferenceModelSettings {
  includeFreeModels?: boolean;
  includeBatchOffers?: boolean;
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return `${Number(val.toFixed(1))}M`;
  }
  if (n >= 1_000) {
    const val = n / 1_000;
    return `${Number(val.toFixed(1))}k`;
  }
  return `${n}`;
}

export function profileSummary(profile: UsageProfile): string {
  const inStr = formatTokenCount(profile.inputTokensPerTask);
  const outStr = formatTokenCount(profile.outputTokensPerTask);
  const cachedPct = Math.round(profile.cachedInputShare * 100);
  const tasksPerDay = profile.tasksPerDay;

  return `${inStr} in / ${outStr} out · ${cachedPct}% cached · ${tasksPerDay}×/day`;
}

export function referenceModels(
  models: ModelEntry[],
  profile: UsageProfile,
  settings?: ReferenceModelSettings,
): ReferenceModelsResult {
  const task = taskFromProfile(profile);
  const totalMonthlyTasks = monthlyTasks(profile);

  const includeFree = settings?.includeFreeModels ?? true;
  const includeBatch = (settings?.includeBatchOffers ?? false) || profile.allowBatch;

  const offerOpts = { includeFree, includeBatch };
  const tiers = assignTiers(models, profile.qualityDimension);

  interface ScoredCandidate {
    model: ModelEntry;
    offer: PriceOffer;
    cost: number;
    monthlyCost: number;
    score?: number;
    tier?: QualityTier;
  }

  const candidates: ScoredCandidate[] = [];

  for (const model of models) {
    const offer = selectOffer(model, task, offerOpts);
    if (!offer) continue;

    const cost = costPerTask(task, offer);
    const monthlyCost = totalMonthlyTasks * cost;
    const score = qualityScore(model, profile.qualityDimension);
    const tier = tiers.get(model.id) ?? model.quality.tier;

    candidates.push({
      model,
      offer,
      cost,
      monthlyCost,
      score,
      tier,
    });
  }

  if (candidates.length === 0) {
    return {};
  }

  function toReferenceEntry(c: ScoredCandidate): ReferenceModelEntry {
    return {
      model: c.model,
      offer: c.offer,
      costPerTaskUsd: c.cost,
      monthlyCostUsd: c.monthlyCost,
      qualityScore: c.score,
      tier: c.tier,
    };
  }

  // 1. Best quality: highest quality score for dimension
  const scoredCandidates = candidates.filter((c) => c.score !== undefined);
  let bestQualityEntry: ReferenceModelEntry | undefined;

  if (scoredCandidates.length > 0) {
    const sortedByQuality = [...scoredCandidates].sort((a, b) => {
      if (b.score! !== a.score!) return b.score! - a.score!;
      if (a.cost !== b.cost) return a.cost - b.cost;
      return a.model.id.localeCompare(b.model.id);
    });
    bestQualityEntry = toReferenceEntry(sortedByQuality[0]!);
  }

  // 2. Best value: cheapest model on Pareto frontier with tier >= B
  const paretoPoints = scoredCandidates.map((c) => ({
    id: c.model.id,
    cost: c.cost,
    quality: c.score,
  }));
  const frontierSet = paretoFrontier(paretoPoints);

  const frontierCandidates = scoredCandidates.filter((c) => frontierSet.has(c.model.id));
  const bestValueCandidates = frontierCandidates.filter((c) => meetsMinTier(c.tier, 'B'));

  let bestValueEntry: ReferenceModelEntry | undefined;
  if (bestValueCandidates.length > 0) {
    bestValueCandidates.sort((a, b) => {
      if (a.cost !== b.cost) return a.cost - b.cost;
      if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
      return a.model.id.localeCompare(b.model.id);
    });
    bestValueEntry = toReferenceEntry(bestValueCandidates[0]!);
  } else if (frontierCandidates.length > 0) {
    frontierCandidates.sort((a, b) => a.cost - b.cost);
    bestValueEntry = toReferenceEntry(frontierCandidates[0]!);
  }

  // 3. Cheapest paid: lowest cost per task with a non-free offer
  const paidCandidates = candidates.filter(
    (c) => !c.offer.isFree && c.offer.channel !== 'openrouter-free',
  );

  let cheapestPaidEntry: ReferenceModelEntry | undefined;
  if (paidCandidates.length > 0) {
    paidCandidates.sort((a, b) => {
      if (a.cost !== b.cost) return a.cost - b.cost;
      if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
      return a.model.id.localeCompare(b.model.id);
    });
    cheapestPaidEntry = toReferenceEntry(paidCandidates[0]!);
  }

  return {
    bestQuality: bestQualityEntry,
    bestValue: bestValueEntry,
    cheapestPaid: cheapestPaidEntry,
  };
}
