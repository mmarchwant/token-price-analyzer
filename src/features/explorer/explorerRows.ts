import {
  costPerTask,
  effectivePerMTok,
  monthlyCost,
  selectOffer,
  taskFromProfile,
  tasksForBudget,
} from '../../domain/pricing';
import { assignTiers, paretoFrontier, qualityPerDollar, qualityScore } from '../../domain/quality';
import type { ModelEntry, PriceOffer, QualityTier, Speed, UsageProfile } from '../../domain/types';

export interface ExplorerRow {
  model: ModelEntry;
  offer: PriceOffer;
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number | undefined;
  effectivePerMTok: number;
  costPerTask: number;
  monthlyCost: number;
  tasksForBudget: number;
  quality: number | undefined;
  tier: QualityTier | undefined;
  qualityPerDollar: number | null;
  isPareto: boolean;
  isFree: boolean;
  openWeights: boolean | null;
  isNew: boolean;
  hasDirect: boolean;
  channelsAvailable: string[];
  contextLength: number | undefined;
  speed: Speed | undefined;
}

export interface BuildExplorerRowsSettings {
  includeFreeModels: boolean;
  includeBatchOffers: boolean;
}

export interface BuildExplorerRowsOptions {
  newModelIds?: Set<string> | string[];
}

export function buildExplorerRows(
  models: ModelEntry[],
  profile: UsageProfile,
  settings: BuildExplorerRowsSettings,
  budgetUsd: number,
  opts?: BuildExplorerRowsOptions,
): ExplorerRow[] {
  const task = taskFromProfile(profile);
  const tierMap = assignTiers(models, profile.qualityDimension);

  let newModelSet: Set<string>;
  if (opts?.newModelIds instanceof Set) {
    newModelSet = opts.newModelIds;
  } else if (Array.isArray(opts?.newModelIds)) {
    newModelSet = new Set(opts.newModelIds);
  } else {
    newModelSet = new Set();
  }

  const rowsWithoutPareto: Omit<ExplorerRow, 'isPareto'>[] = [];

  for (const model of models) {
    const offer = selectOffer(model, task, {
      includeFree: settings.includeFreeModels,
      includeBatch: settings.includeBatchOffers && profile.allowBatch,
    });

    if (!offer) {
      continue;
    }

    const cPerTask = costPerTask(task, offer);
    const effPerM = effectivePerMTok(task, offer);
    const mCost = monthlyCost(profile, offer);
    const tForBudget = tasksForBudget(budgetUsd, task, offer);

    const qScore = qualityScore(model, profile.qualityDimension);
    const tier = tierMap.get(model.id) ?? model.quality.tier;
    const qPerDollar = qualityPerDollar(qScore, cPerTask);

    const isFree = offer.isFree || offer.channel === 'openrouter-free';
    const openWeights = model.openWeights;
    const isNew = newModelSet.has(model.id);
    const hasDirect = model.offers.some((o) => o.channel === 'direct');

    const channelsSet = new Set<string>();
    for (const o of model.offers) {
      channelsSet.add(o.channel);
    }
    const channelsAvailable = Array.from(channelsSet);

    rowsWithoutPareto.push({
      model,
      offer,
      inputPerMTok: offer.inputPerMTok,
      outputPerMTok: offer.outputPerMTok,
      cacheReadPerMTok: offer.cacheReadPerMTok,
      effectivePerMTok: effPerM,
      costPerTask: cPerTask,
      monthlyCost: mCost,
      tasksForBudget: tForBudget,
      quality: qScore,
      tier,
      qualityPerDollar: qPerDollar,
      isFree,
      openWeights,
      isNew,
      hasDirect,
      channelsAvailable,
      contextLength: model.contextLength,
      speed: model.speed,
    });
  }

  const paretoPoints = rowsWithoutPareto.map((r) => ({
    id: r.model.id,
    cost: r.costPerTask,
    quality: r.quality,
  }));

  const paretoSet = paretoFrontier(paretoPoints);

  return rowsWithoutPareto.map((r) => ({
    ...r,
    isPareto: paretoSet.has(r.model.id),
  }));
}
