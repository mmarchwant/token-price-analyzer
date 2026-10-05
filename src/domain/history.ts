import type {
  HistoryIndex,
  ModelEntry,
  PlanPricePoint,
  PriceHistory,
  PriceOffer,
  PricePoint,
  Snapshot,
} from './types';

export function referenceOffer(model: ModelEntry): PriceOffer | undefined {
  const openrouterOffers = model.offers.filter((o) => o.channel === 'openrouter' && !o.isFree);

  if (openrouterOffers.length > 0) {
    let cheapest = openrouterOffers[0]!;
    let minPrice = cheapest.inputPerMTok + cheapest.outputPerMTok;
    for (let i = 1; i < openrouterOffers.length; i++) {
      const offer = openrouterOffers[i]!;
      const price = offer.inputPerMTok + offer.outputPerMTok;
      if (price < minPrice) {
        minPrice = price;
        cheapest = offer;
      }
    }
    return cheapest;
  }

  const directOffers = model.offers.filter((o) => o.channel === 'direct' && !o.isFree);
  if (directOffers.length > 0) {
    let cheapest = directOffers[0]!;
    let minPrice = cheapest.inputPerMTok + cheapest.outputPerMTok;
    for (let i = 1; i < directOffers.length; i++) {
      const offer = directOffers[i]!;
      const price = offer.inputPerMTok + offer.outputPerMTok;
      if (price < minPrice) {
        minPrice = price;
        cheapest = offer;
      }
    }
    return cheapest;
  }

  return undefined;
}

export function appendSnapshotToHistory(
  history: PriceHistory | undefined,
  snapshot: Snapshot,
  date: string,
  carryFrom?: PriceHistory,
): PriceHistory {
  const year = parseInt(date.split('-')[0]!, 10);
  const Jan1Date = `${year}-01-01`;

  const updated: PriceHistory = history
    ? {
        ...history,
        updatedAt: snapshot.generatedAt,
        models: { ...history.models },
        subscriptions: { ...history.subscriptions },
      }
    : {
        schemaVersion: 1,
        year,
        updatedAt: snapshot.generatedAt,
        models: {},
        subscriptions: {},
      };

  // Seed missing models & subscriptions from carryFrom if present
  if (carryFrom) {
    for (const [modelId, entry] of Object.entries(carryFrom.models)) {
      if (!updated.models[modelId]) {
        const lastPoint = entry.points[entry.points.length - 1];
        if (lastPoint) {
          updated.models[modelId] = {
            firstSeen: entry.firstSeen,
            points: [[Jan1Date, lastPoint[1], lastPoint[2]]],
          };
        }
      }
    }

    for (const [planId, entry] of Object.entries(carryFrom.subscriptions)) {
      if (!updated.subscriptions[planId]) {
        const lastPoint = entry.points[entry.points.length - 1];
        if (lastPoint) {
          updated.subscriptions[planId] = {
            firstSeen: entry.firstSeen,
            points: [[Jan1Date, lastPoint[1]]],
          };
        }
      }
    }
  }

  // Process models from current snapshot
  for (const model of snapshot.models) {
    const ref = referenceOffer(model);
    if (!ref) {
      continue;
    }

    const inPrice = ref.inputPerMTok;
    const outPrice = ref.outputPerMTok;

    let modelEntry = updated.models[model.id];
    if (!modelEntry) {
      modelEntry = {
        firstSeen: date,
        points: [],
      };
      updated.models[model.id] = modelEntry;
    }

    const points = [...modelEntry.points];
    const lastPoint = points[points.length - 1];

    if (!lastPoint) {
      points.push([date, inPrice, outPrice]);
    } else if (lastPoint[0] === date) {
      lastPoint[1] = inPrice;
      lastPoint[2] = outPrice;
    } else if (
      Math.abs(lastPoint[1] - inPrice) > 1e-9 ||
      Math.abs(lastPoint[2] - outPrice) > 1e-9
    ) {
      points.push([date, inPrice, outPrice]);
    }

    updated.models[model.id] = {
      ...modelEntry,
      points,
    };
  }

  // Process subscriptions from current snapshot
  for (const plan of snapshot.subscriptions) {
    const price = plan.priceUsdMonthly;

    let subEntry = updated.subscriptions[plan.id];
    if (!subEntry) {
      subEntry = {
        firstSeen: date,
        points: [],
      };
      updated.subscriptions[plan.id] = subEntry;
    }

    const points = [...subEntry.points];
    const lastPoint = points[points.length - 1];

    if (!lastPoint) {
      points.push([date, price]);
    } else if (lastPoint[0] === date) {
      lastPoint[1] = price;
    } else if (Math.abs(lastPoint[1] - price) > 1e-9) {
      points.push([date, price]);
    }

    updated.subscriptions[plan.id] = {
      ...subEntry,
      points,
    };
  }

  return updated;
}

export function updateHistoryIndex(
  index: HistoryIndex | undefined,
  year: number,
  now: Date | string,
): HistoryIndex {
  const updatedAt = typeof now === 'string' ? now : now.toISOString();
  const existingYears = index ? index.years : [];
  const yearsSet = new Set([...existingYears, year]);
  const sortedYears = Array.from(yearsSet).sort((a, b) => a - b);

  return {
    schemaVersion: 1,
    years: sortedYears,
    updatedAt,
  };
}

export function priceAt<T extends PricePoint | PlanPricePoint>(
  points: T[],
  date: string,
): T | undefined {
  let effectivePoint: T | undefined;
  for (const point of points) {
    if (point[0] <= date) {
      if (!effectivePoint || point[0] > effectivePoint[0]) {
        effectivePoint = point;
      }
    }
  }
  return effectivePoint;
}
