import type { ChannelFee, ModelEntry, PriceOffer, Speed, TaskShape, UsageProfile } from './types';

export function effectivePrices(offer: PriceOffer, inputTokens: number) {
  if (offer.longContext && inputTokens > offer.longContext.thresholdTokens) {
    return {
      inputPerMTok: offer.longContext.inputPerMTok,
      outputPerMTok: offer.longContext.outputPerMTok,
      cacheReadPerMTok: offer.longContext.cacheReadPerMTok ?? offer.cacheReadPerMTok,
      cacheWritePerMTok: offer.cacheWritePerMTok,
    };
  }
  return {
    inputPerMTok: offer.inputPerMTok,
    outputPerMTok: offer.outputPerMTok,
    cacheReadPerMTok: offer.cacheReadPerMTok,
    cacheWritePerMTok: offer.cacheWritePerMTok,
  };
}

export function costPerTask(
  task: TaskShape,
  offer: PriceOffer,
  opts?: { chargeCacheWrites?: boolean },
): number {
  if (offer.isFree) {
    return 0;
  }

  const rates = effectivePrices(offer, task.inputTokens);
  const chargeCacheWrites = opts?.chargeCacheWrites ?? true;

  const cached = task.inputTokens * task.cachedInputShare;
  const uncached = task.inputTokens - cached;

  const cachedPrice = rates.cacheReadPerMTok ?? rates.inputPerMTok;
  const uncachedPrice =
    chargeCacheWrites && task.cachedInputShare > 0 && rates.cacheWritePerMTok !== undefined
      ? rates.cacheWritePerMTok
      : rates.inputPerMTok;

  const inputCost = cached * cachedPrice + uncached * uncachedPrice;
  const outputCost = task.outputTokens * rates.outputPerMTok;

  return (inputCost + outputCost) / 1e6;
}

export function effectivePerMTok(task: TaskShape, offer: PriceOffer): number {
  const totalTokens = task.inputTokens + task.outputTokens;
  if (totalTokens === 0) {
    return 0;
  }
  return (costPerTask(task, offer) / totalTokens) * 1e6;
}

export function taskFromProfile(profile: UsageProfile): TaskShape {
  return {
    inputTokens: profile.inputTokensPerTask,
    outputTokens: profile.outputTokensPerTask,
    cachedInputShare: profile.cachedInputShare,
  };
}

export function monthlyTasks(profile: UsageProfile): number {
  return profile.tasksPerDay * profile.workDaysPerMonth;
}

export function monthlyCost(profile: UsageProfile, offer: PriceOffer): number {
  return monthlyTasks(profile) * costPerTask(taskFromProfile(profile), offer);
}

export function tasksForBudget(budgetUsd: number, task: TaskShape, offer: PriceOffer): number {
  const cost = costPerTask(task, offer);
  if (cost === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.floor(budgetUsd / cost);
}

export function workDaysForBudget(
  budgetUsd: number,
  profile: UsageProfile,
  offer: PriceOffer,
): number {
  const cost = costPerTask(taskFromProfile(profile), offer);
  const dailyCost = cost * profile.tasksPerDay;
  if (dailyCost === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return budgetUsd / dailyCost;
}

export function tokensForBudget(
  budgetUsd: number,
  task: TaskShape,
  offer: PriceOffer,
): { inputTokens: number; outputTokens: number } {
  const cost = costPerTask(task, offer);
  if (cost === 0) {
    return {
      inputTokens: task.inputTokens > 0 ? Number.POSITIVE_INFINITY : 0,
      outputTokens: task.outputTokens > 0 ? Number.POSITIVE_INFINITY : 0,
    };
  }
  const factor = budgetUsd / cost;
  return {
    inputTokens: task.inputTokens * factor,
    outputTokens: task.outputTokens * factor,
  };
}

export function generationSecondsPerTask(task: TaskShape, speed?: Speed): number | null {
  if (!speed || speed.outputTokensPerSecond === undefined || speed.outputTokensPerSecond <= 0) {
    return null;
  }
  const ttft = speed.timeToFirstTokenSeconds ?? 0;
  return ttft + task.outputTokens / speed.outputTokensPerSecond;
}

export function selectOffer(
  model: ModelEntry,
  task: TaskShape,
  opts: { includeFree: boolean; includeBatch: boolean },
): PriceOffer | undefined {
  const eligible = model.offers.filter((offer) => {
    if ((offer.isFree || offer.channel === 'openrouter-free') && !opts.includeFree) {
      return false;
    }
    if (offer.channel === 'openrouter-batch' && !opts.includeBatch) {
      return false;
    }
    return true;
  });

  const firstOffer = eligible[0];
  if (!firstOffer) {
    return undefined;
  }

  let bestOffer = firstOffer;
  let bestCost = costPerTask(task, bestOffer);

  for (let i = 1; i < eligible.length; i++) {
    const offer = eligible[i];
    if (!offer) continue;
    const cost = costPerTask(task, offer);

    if (cost < bestCost) {
      bestOffer = offer;
      bestCost = cost;
    } else if (cost === bestCost) {
      // Direct channel preferred over openrouter
      if (offer.channel === 'direct' && bestOffer.channel !== 'direct') {
        bestOffer = offer;
        bestCost = cost;
      }
    }
  }

  return bestOffer;
}

export function usableCredit(budgetUsd: number, fee?: ChannelFee): number {
  if (!fee) {
    return budgetUsd;
  }
  if (budgetUsd < fee.minTopUpUsd) {
    return 0;
  }
  const feeAmount = Math.max((budgetUsd * fee.purchaseFeePct) / 100, fee.minFeeUsd);
  return Math.max(0, budgetUsd - feeAmount);
}
