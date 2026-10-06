import type { ModelEntry, PriceOffer, QualityScores } from '../types';

export interface MergeLiveModelsResult {
  models: ModelEntry[];
  changedPriceIds: Set<string>;
  newModelIds: Set<string>;
}

function hasQualityScores(quality: QualityScores): boolean {
  return (
    quality.source !== 'none' ||
    quality.intelligence !== undefined ||
    quality.coding !== undefined ||
    quality.agentic !== undefined
  );
}

function areOffersPricesDifferent(snapshotOffers: PriceOffer[], liveOffers: PriceOffer[]): boolean {
  const snapOR = snapshotOffers.filter((o) => o.channel.startsWith('openrouter'));
  const liveOR = liveOffers.filter((o) => o.channel.startsWith('openrouter'));

  if (snapOR.length !== liveOR.length) {
    return true;
  }

  for (const liveOf of liveOR) {
    const snapOf = snapOR.find((o) => o.channel === liveOf.channel);
    if (!snapOf) {
      return true;
    }
    if (
      snapOf.inputPerMTok !== liveOf.inputPerMTok ||
      snapOf.outputPerMTok !== liveOf.outputPerMTok
    ) {
      return true;
    }
    if (
      snapOf.longContext?.inputPerMTok !== liveOf.longContext?.inputPerMTok ||
      snapOf.longContext?.outputPerMTok !== liveOf.longContext?.outputPerMTok
    ) {
      return true;
    }
  }

  return false;
}

export function mergeLiveModels(
  snapshotModels: ModelEntry[],
  liveModels: ModelEntry[],
): MergeLiveModelsResult {
  const changedPriceIds = new Set<string>();
  const newModelIds = new Set<string>();

  const liveMap = new Map<string, ModelEntry>();
  for (const liveModel of liveModels) {
    liveMap.set(liveModel.id, liveModel);
  }

  const mergedSnapshotModels: ModelEntry[] = snapshotModels.map((snapModel) => {
    const liveModel = liveMap.get(snapModel.id);
    if (!liveModel) {
      return snapModel;
    }

    // Compare prices between snapshot openrouter offers and live openrouter offers
    const pricesChanged = areOffersPricesDifferent(snapModel.offers, liveModel.offers);
    if (pricesChanged) {
      changedPriceIds.add(snapModel.id);
    }

    // Merge offers: keep snapshot direct offers, replace openrouter* offers with live openrouter* offers
    const snapDirectOffers = snapModel.offers.filter((o) => o.channel === 'direct');
    const liveOpenRouterOffers = liveModel.offers.filter((o) => o.channel.startsWith('openrouter'));
    const mergedOffers = [...snapDirectOffers, ...liveOpenRouterOffers];

    // Merge quality
    let mergedQuality = snapModel.quality;
    const snapQualitySource = snapModel.quality.source;
    if (
      (snapQualitySource === 'none' || snapQualitySource === 'openrouter-aa') &&
      hasQualityScores(liveModel.quality)
    ) {
      mergedQuality = {
        ...liveModel.quality,
        tier: snapModel.quality.tier,
      };
    }

    return {
      ...snapModel,
      offers: mergedOffers.length > 0 ? mergedOffers : snapModel.offers,
      quality: mergedQuality,
    };
  });

  // Identify live-only models
  const snapSet = new Set(snapshotModels.map((m) => m.id));
  const liveOnlyModels: ModelEntry[] = [];

  for (const liveModel of liveModels) {
    if (!snapSet.has(liveModel.id)) {
      newModelIds.add(liveModel.id);
      liveOnlyModels.push({
        ...liveModel,
        quality: {
          ...liveModel.quality,
          tier: undefined,
        },
      });
    }
  }

  return {
    models: [...mergedSnapshotModels, ...liveOnlyModels],
    changedPriceIds,
    newModelIds,
  };
}
