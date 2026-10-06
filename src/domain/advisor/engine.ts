import { costPerTask, selectOffer, taskFromProfile, usableCredit } from '../pricing';
import { assignTiers, meetsMinTier, qualityScore, tierWeight } from '../quality';
import { capacityTasks, coverage } from '../subscriptions';
import type { ChannelFee, ModelEntry, QualityTier, SubscriptionPlan } from '../types';
import type { AdvisorInput, Needs, Recommendation, Reason, Strategy } from './types';

const CONFIDENCE_FACTORS: Record<string, number> = {
  official: 1.0,
  reported: 0.95,
  estimated: 0.9,
};

const TIER_RANK: Record<QualityTier, number> = {
  S: 4,
  A: 3,
  B: 2,
  C: 1,
  D: 0,
};

function higherTier(a?: QualityTier, b?: QualityTier): QualityTier | undefined {
  if (!a) return b;
  if (!b) return a;
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

export function isModelEligible(
  model: ModelEntry,
  needs: Needs,
  minTier: QualityTier | 'any',
  modelTiers: Map<string, QualityTier>,
): boolean {
  const tier = modelTiers.get(model.id) ?? model.quality.tier;
  if (minTier !== 'any' && !meetsMinTier(tier, minTier)) {
    return false;
  }
  if (needs.codingAgent && !model.capabilities.tools) {
    return false;
  }
  if (needs.toolCalling && !model.capabilities.tools) {
    return false;
  }
  if (needs.longContext && (model.contextLength ?? 0) < 500000) {
    return false;
  }
  if (needs.openWeights && model.openWeights !== true) {
    return false;
  }
  if (needs.imageGeneration && !model.outputModalities.includes('image')) {
    return false;
  }
  return true;
}

export function isPlanEligible(
  plan: SubscriptionPlan,
  needs: Needs,
  minTier: QualityTier | 'any',
  models: ModelEntry[],
  modelTiers: Map<string, QualityTier>,
): boolean {
  const primaryModel = models.find((m) => m.id === plan.primaryModelId);
  const tier = modelTiers.get(plan.primaryModelId) ?? primaryModel?.quality.tier;

  if (minTier !== 'any' && !meetsMinTier(tier, minTier)) {
    return false;
  }
  if (needs.codingAgent && plan.features.codingAgents.length === 0) {
    return false;
  }
  if (needs.imageGeneration && !plan.features.imageGeneration) {
    return false;
  }
  if (needs.deepResearch && !plan.features.deepResearch) {
    return false;
  }
  if (needs.longContext) {
    const planLongCtx = plan.features.longContextTokens ?? 0;
    const modelLongCtx = primaryModel?.contextLength ?? 0;
    if (planLongCtx < 500000 && modelLongCtx < 500000) {
      return false;
    }
  }
  if (needs.openWeights && primaryModel?.openWeights !== true) {
    return false;
  }
  if (needs.toolCalling) {
    const modelHasTools = primaryModel?.capabilities.tools === true;
    const planHasCodingAgents = plan.features.codingAgents.length > 0;
    const planHasApi = plan.features.apiAccess === true;
    if (!modelHasTools && !planHasCodingAgents && !planHasApi) {
      return false;
    }
  }
  return true;
}

function getFeeForModelOffer(
  vendor: string,
  channel: string,
  fees: ChannelFee[],
): ChannelFee | undefined {
  if (channel.startsWith('openrouter')) {
    return fees.find((f) => f.vendor === 'openrouter');
  }
  return fees.find((f) => f.vendor === vendor);
}

export function generateCandidates(
  input: AdvisorInput,
  data: {
    models: ModelEntry[];
    plans?: SubscriptionPlan[];
    subscriptions?: SubscriptionPlan[];
    fees?: ChannelFee[];
    channelFees?: ChannelFee[];
  },
): Recommendation[] {
  const plans = data.plans ?? data.subscriptions ?? [];
  const fees = data.fees ?? data.channelFees ?? [];
  const models = data.models ?? [];

  const {
    budgetUsd,
    profile,
    intensity,
    activeHoursPerDay,
    needs,
    minTier,
    includeFree,
    preferFlexibility,
  } = input;
  const task = taskFromProfile(profile);
  const demandTasks = Math.round(profile.tasksPerDay * intensity * profile.workDaysPerMonth);

  const modelTiers = assignTiers(models, profile.qualityDimension);

  const eligibleModels = models.filter((m) => isModelEligible(m, needs, minTier, modelTiers));

  let maxQualityAmongEligibleApiModels = 0;
  for (const m of eligibleModels) {
    const q = qualityScore(m, profile.qualityDimension) ?? tierWeight(modelTiers.get(m.id)) * 100;
    if (q > maxQualityAmongEligibleApiModels) {
      maxQualityAmongEligibleApiModels = q;
    }
  }
  if (maxQualityAmongEligibleApiModels <= 0) {
    maxQualityAmongEligibleApiModels = 100;
  }

  const eligiblePlans = plans.filter((p) => isPlanEligible(p, needs, minTier, models, modelTiers));

  const candidates: Recommendation[] = [];

  // 1. API candidates
  const apiCandidatesRaw: Recommendation[] = [];
  for (const model of eligibleModels) {
    const offer = selectOffer(model, task, {
      includeFree,
      includeBatch: profile.allowBatch,
    });
    if (!offer) continue;

    const fee = getFeeForModelOffer(offer.vendor, offer.channel, fees);
    const costPerTaskUsd = costPerTask(task, offer);
    const demandCost = demandTasks * costPerTaskUsd;

    let covLow: number;
    let monthlyCostUsd: number;

    if (offer.isFree || costPerTaskUsd === 0) {
      covLow = 1;
      monthlyCostUsd = 0;
    } else if (budgetUsd === 0) {
      covLow = 0;
      monthlyCostUsd = 0;
    } else {
      const credit = usableCredit(Math.min(budgetUsd, demandCost), fee);
      covLow = demandCost > 0 ? Math.min(1, credit / demandCost) : 1;

      const feePct = fee?.purchaseFeePct ?? 0;
      const minFee = fee?.minFeeUsd ?? 0;
      const feeAmount = demandCost > 0 ? Math.max((demandCost * feePct) / 100, minFee) : 0;
      monthlyCostUsd = Math.min(budgetUsd, demandCost + (fee ? feeAmount : 0));
    }

    const tier = modelTiers.get(model.id) ?? model.quality.tier;
    const q = qualityScore(model, profile.qualityDimension) ?? tierWeight(tier) * 100;
    const qualityNorm = Math.min(1.0, q / maxQualityAmongEligibleApiModels);
    const coverageScore = covLow;
    const flexBonus = preferFlexibility ? 1.05 : 1.0;
    const rawScore =
      100 * Math.pow(qualityNorm, 1.5) * Math.pow(coverageScore, 0.8) * 1.0 * flexBonus;
    const score = Math.round(Math.min(100, Math.max(0, rawScore)) * 10) / 10;

    const reasons: Reason[] = [];
    const warnings: Reason[] = [];

    if (covLow >= 0.999) {
      reasons.push({ code: 'covers-demand', params: { pct: 100 } });
    } else {
      reasons.push({ code: 'partial-coverage', params: { pct: Math.round(covLow * 100) } });
    }

    if (needs.deepResearch) {
      warnings.push({ code: 'deep-research-not-in-api' });
    }

    if (offer.isFree || offer.channel === 'openrouter-free') {
      warnings.push({ code: 'free-rate-limited' });
    }

    apiCandidatesRaw.push({
      id: `api:${model.id}`,
      strategy: 'api',
      planIds: [],
      modelIds: [model.id],
      monthlyCostUsd,
      coverage: { low: covLow, high: covLow },
      quality: q,
      tier,
      score,
      reasons,
      warnings,
    });
  }

  // Sort API candidates by quality * coverage before keeping top 10
  apiCandidatesRaw.sort((a, b) => {
    const qA = (a.quality ?? 0) * (a.coverage?.low ?? 0);
    const qB = (b.quality ?? 0) * (b.coverage?.low ?? 0);
    return qB - qA;
  });

  const topApiCandidates = apiCandidatesRaw.slice(0, 10);
  candidates.push(...topApiCandidates);

  // 2. Subscription candidates
  const subCandidates: { plan: SubscriptionPlan; rec: Recommendation }[] = [];
  for (const plan of eligiblePlans) {
    if (plan.priceUsdMonthly > budgetUsd) continue;

    const primaryModel = models.find((m) => m.id === plan.primaryModelId);
    const primaryOffer = primaryModel
      ? selectOffer(primaryModel, task, { includeFree: true, includeBatch: false })
      : undefined;

    const cap = capacityTasks(plan, profile, primaryOffer, {
      activeHoursPerDay,
      workDaysPerMonth: profile.workDaysPerMonth,
    });
    const cov = coverage(cap, demandTasks);

    const primaryTier = modelTiers.get(plan.primaryModelId) ?? primaryModel?.quality.tier;
    const q = primaryModel
      ? (qualityScore(primaryModel, profile.qualityDimension) ?? tierWeight(primaryTier) * 100)
      : tierWeight(primaryTier) * 100;

    const qualityNorm = Math.min(1.0, q / maxQualityAmongEligibleApiModels);
    const coverageScore = cov ? cov.low : 0.6;
    const confFactor = CONFIDENCE_FACTORS[plan.confidence] ?? 0.9;
    const rawScore = 100 * Math.pow(qualityNorm, 1.5) * Math.pow(coverageScore, 0.8) * confFactor;
    const score = Math.round(Math.min(100, Math.max(0, rawScore)) * 10) / 10;

    const reasons: Reason[] = [];
    const warnings: Reason[] = [];

    if (cov) {
      if (cov.low >= 0.999) {
        reasons.push({ code: 'covers-demand', params: { pct: 100 } });
      } else {
        reasons.push({ code: 'partial-coverage', params: { pct: Math.round(cov.low * 100) } });
      }
    } else {
      warnings.push({ code: 'limits-unpublished' });
    }

    if (plan.confidence === 'reported' || plan.confidence === 'estimated') {
      warnings.push({ code: 'estimate-low-confidence' });
    }

    if (plan.features.codingAgents.length > 0) {
      reasons.push({
        code: 'includes-coding-agent',
        params: { agents: plan.features.codingAgents.join(', ') },
      });
    }

    const rec: Recommendation = {
      id: `sub:${plan.id}`,
      strategy: 'subscription',
      planIds: [plan.id],
      modelIds: [plan.primaryModelId],
      monthlyCostUsd: plan.priceUsdMonthly,
      coverage: cov,
      quality: q,
      tier: primaryTier,
      score,
      reasons,
      warnings,
    };

    subCandidates.push({ plan, rec });
    candidates.push(rec);
  }

  // 3. Subscription + API top-up candidates
  for (const { plan, rec: subRec } of subCandidates) {
    const planCov = subRec.coverage;
    if (!planCov || planCov.low >= 0.999) continue;

    const leftover = budgetUsd - plan.priceUsdMonthly;
    if (leftover <= 0) continue;

    const uncoveredTasks = demandTasks * (1 - planCov.low);

    let bestCombo: Recommendation | null = null;

    for (const apiModel of eligibleModels) {
      const offer = selectOffer(apiModel, task, {
        includeFree,
        includeBatch: profile.allowBatch,
      });
      if (!offer) continue;

      const fee = getFeeForModelOffer(offer.vendor, offer.channel, fees);
      const minTopUp = fee ? fee.minTopUpUsd : 0;
      if (leftover < Math.max(5, minTopUp)) continue;

      const costPerTaskUsd = costPerTask(task, offer);
      const uncoveredDemandCost = uncoveredTasks * costPerTaskUsd;

      const apiCredit = usableCredit(Math.min(leftover, uncoveredDemandCost), fee);
      const totalDemandCost = demandTasks * costPerTaskUsd;
      const apiShare = totalDemandCost > 0 ? apiCredit / totalDemandCost : 0;

      const combinedCovLow = Math.min(1, planCov.low + apiShare);
      const combinedCovHigh = Math.min(1, planCov.high + apiShare);

      const feePct = fee?.purchaseFeePct ?? 0;
      const minFee = fee?.minFeeUsd ?? 0;
      const spentForApi = Math.min(leftover, uncoveredDemandCost);
      const topUpFeeAmount = spentForApi > 0 ? Math.max((spentForApi * feePct) / 100, minFee) : 0;
      const comboCostUsd =
        plan.priceUsdMonthly + Math.min(leftover, spentForApi + (fee ? topUpFeeAmount : 0));

      const apiTier = modelTiers.get(apiModel.id) ?? apiModel.quality.tier;
      const apiQ = qualityScore(apiModel, profile.qualityDimension) ?? tierWeight(apiTier) * 100;
      const planQ = subRec.quality ?? 0;

      const totalCovShare = combinedCovLow > 0 ? combinedCovLow : 1;
      const comboQ = (planQ * planCov.low + apiQ * apiShare) / totalCovShare;

      const qualityNorm = Math.min(1.0, comboQ / maxQualityAmongEligibleApiModels);
      const coverageScore = combinedCovLow;
      const confFactor = CONFIDENCE_FACTORS[plan.confidence] ?? 0.9;
      const rawScore = 100 * Math.pow(qualityNorm, 1.5) * Math.pow(coverageScore, 0.8) * confFactor;
      const score = Math.round(Math.min(100, Math.max(0, rawScore)) * 10) / 10;

      const reasons: Reason[] = [];
      const warnings: Reason[] = [];

      if (combinedCovLow >= 0.999) {
        reasons.push({ code: 'covers-demand', params: { pct: 100 } });
      } else {
        reasons.push({
          code: 'partial-coverage',
          params: { pct: Math.round(combinedCovLow * 100) },
        });
      }

      if (plan.features.codingAgents.length > 0) {
        reasons.push({
          code: 'includes-coding-agent',
          params: { agents: plan.features.codingAgents.join(', ') },
        });
      }

      if (topUpFeeAmount > 0) {
        reasons.push({
          code: 'top-up-fee',
          params: { usd: Math.round(topUpFeeAmount * 100) / 100 },
        });
      }

      const leftoverAfterCombo = Math.round((budgetUsd - comboCostUsd) * 100) / 100;
      if (leftoverAfterCombo >= 1) {
        reasons.push({ code: 'leftover-budget', params: { usd: leftoverAfterCombo } });
      }

      if (plan.confidence === 'reported' || plan.confidence === 'estimated') {
        warnings.push({ code: 'estimate-low-confidence' });
      }

      if (needs.deepResearch) {
        warnings.push({ code: 'deep-research-not-in-api' });
      }

      const comboRec: Recommendation = {
        id: `sub+api:${plan.id}:${apiModel.id}`,
        strategy: 'subscription+api',
        planIds: [plan.id],
        modelIds: [apiModel.id],
        monthlyCostUsd: comboCostUsd,
        coverage: { low: combinedCovLow, high: combinedCovHigh },
        quality: comboQ,
        tier: higherTier(subRec.tier, apiTier),
        score,
        reasons,
        warnings,
      };

      if (!bestCombo || comboRec.score > bestCombo.score) {
        bestCombo = comboRec;
      }
    }

    if (bestCombo) {
      candidates.push(bestCombo);
    }
  }

  // 4. Two-subscriptions candidates
  const topSubSingle = subCandidates
    .filter((s) => s.rec.coverage !== null)
    .sort((a, b) => (b.rec.coverage?.low ?? 0) - (a.rec.coverage?.low ?? 0))
    .slice(0, 6);

  for (let i = 0; i < topSubSingle.length; i++) {
    for (let j = i + 1; j < topSubSingle.length; j++) {
      const s1 = topSubSingle[i]!;
      const s2 = topSubSingle[j]!;

      if (s1.plan.provider === s2.plan.provider) continue;

      const totalPrice = s1.plan.priceUsdMonthly + s2.plan.priceUsdMonthly;
      if (totalPrice > budgetUsd) continue;

      const primaryModel1 = models.find((m) => m.id === s1.plan.primaryModelId);
      const primaryOffer1 = primaryModel1
        ? selectOffer(primaryModel1, task, { includeFree: true, includeBatch: false })
        : undefined;
      const cap1 = capacityTasks(s1.plan, profile, primaryOffer1, {
        activeHoursPerDay,
        workDaysPerMonth: profile.workDaysPerMonth,
      });

      const primaryModel2 = models.find((m) => m.id === s2.plan.primaryModelId);
      const primaryOffer2 = primaryModel2
        ? selectOffer(primaryModel2, task, { includeFree: true, includeBatch: false })
        : undefined;
      const cap2 = capacityTasks(s2.plan, profile, primaryOffer2, {
        activeHoursPerDay,
        workDaysPerMonth: profile.workDaysPerMonth,
      });

      const combinedCap =
        cap1 && cap2 ? { low: cap1.low + cap2.low, high: cap1.high + cap2.high } : null;
      const combinedCov = coverage(combinedCap, demandTasks);

      const q1 = s1.rec.quality ?? 0;
      const q2 = s2.rec.quality ?? 0;
      const cap1Low = cap1?.low ?? 1;
      const cap2Low = cap2?.low ?? 1;
      const comboQ =
        cap1Low + cap2Low > 0 ? (q1 * cap1Low + q2 * cap2Low) / (cap1Low + cap2Low) : (q1 + q2) / 2;

      const qualityNorm = Math.min(1.0, comboQ / maxQualityAmongEligibleApiModels);
      const coverageScore = combinedCov ? combinedCov.low : 0.6;
      const confFactor = Math.min(
        CONFIDENCE_FACTORS[s1.plan.confidence] ?? 0.9,
        CONFIDENCE_FACTORS[s2.plan.confidence] ?? 0.9,
      );
      const rawScore = 100 * Math.pow(qualityNorm, 1.5) * Math.pow(coverageScore, 0.8) * confFactor;
      const score = Math.round(Math.min(100, Math.max(0, rawScore)) * 10) / 10;

      const reasons: Reason[] = [{ code: 'separate-limit-pools' }];
      const warnings: Reason[] = [];

      if (combinedCov) {
        if (combinedCov.low >= 0.999) {
          reasons.push({ code: 'covers-demand', params: { pct: 100 } });
        } else {
          reasons.push({
            code: 'partial-coverage',
            params: { pct: Math.round(combinedCov.low * 100) },
          });
        }
      } else {
        warnings.push({ code: 'limits-unpublished' });
      }

      const allAgents = [...s1.plan.features.codingAgents, ...s2.plan.features.codingAgents];
      if (allAgents.length > 0) {
        reasons.push({
          code: 'includes-coding-agent',
          params: { agents: Array.from(new Set(allAgents)).join(', ') },
        });
      }

      const leftover = Math.round((budgetUsd - totalPrice) * 100) / 100;
      if (leftover >= 1) {
        reasons.push({ code: 'leftover-budget', params: { usd: leftover } });
      }

      if (
        s1.plan.confidence === 'reported' ||
        s1.plan.confidence === 'estimated' ||
        s2.plan.confidence === 'reported' ||
        s2.plan.confidence === 'estimated'
      ) {
        warnings.push({ code: 'estimate-low-confidence' });
      }

      candidates.push({
        id: `sub+sub:${s1.plan.id}:${s2.plan.id}`,
        strategy: 'two-subscriptions',
        planIds: [s1.plan.id, s2.plan.id],
        modelIds: [s1.plan.primaryModelId, s2.plan.primaryModelId],
        monthlyCostUsd: totalPrice,
        coverage: combinedCov,
        quality: comboQ,
        tier: higherTier(s1.rec.tier, s2.rec.tier),
        score,
        reasons,
        warnings,
      });
    }
  }

  return candidates;
}

export function advise(
  input: AdvisorInput,
  data: {
    models: ModelEntry[];
    plans?: SubscriptionPlan[];
    subscriptions?: SubscriptionPlan[];
    fees?: ChannelFee[];
    channelFees?: ChannelFee[];
  },
): Recommendation[] {
  const plans = data.plans ?? data.subscriptions ?? [];
  const models = data.models ?? [];

  const candidates = generateCandidates(input, data);
  if (candidates.length === 0) {
    return [];
  }

  // Sort candidates by score descending, then monthlyCostUsd ascending, then id ascending
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.monthlyCostUsd !== b.monthlyCostUsd) {
      return a.monthlyCostUsd - b.monthlyCostUsd;
    }
    return a.id.localeCompare(b.id);
  });

  // Track provider for main item
  const providerCount = new Map<string, number>();
  const strategyCount = new Map<Strategy, number>();

  const bestApi = candidates.find((c) => c.strategy === 'api');
  const bestSub = candidates.find((c) => c.strategy === 'subscription');

  function getProviderForCandidate(c: Recommendation): string {
    if (c.strategy === 'api') {
      const model = models.find((m) => m.id === c.modelIds[0]);
      return model?.provider ?? 'unknown';
    }
    if (c.planIds.length > 0) {
      const plan = plans.find((p) => p.id === c.planIds[0]);
      return plan?.provider ?? 'unknown';
    }
    return 'unknown';
  }

  const selected: Recommendation[] = [];

  for (const c of candidates) {
    if (selected.length >= 7) break;

    const sCount = strategyCount.get(c.strategy) ?? 0;
    if (sCount >= 3) continue;

    const provider = getProviderForCandidate(c);
    const pCount = providerCount.get(provider) ?? 0;
    if (pCount >= 2) continue;

    strategyCount.set(c.strategy, sCount + 1);
    providerCount.set(provider, pCount + 1);
    selected.push(c);
  }

  // Always include best api and best subscription if existing
  if (bestApi && !selected.some((s) => s.id === bestApi.id)) {
    selected.push(bestApi);
  }
  if (bestSub && !selected.some((s) => s.id === bestSub.id)) {
    selected.push(bestSub);
  }

  // Add top-pick highlights
  if (selected.length > 0) {
    // Add best-value to first element
    if (!selected[0]!.reasons.some((r) => r.code === 'best-value')) {
      selected[0]!.reasons.unshift({ code: 'best-value' });
    }

    // Find item with max quality
    let bestQualityRec = selected[0]!;
    for (const item of selected) {
      if ((item.quality ?? 0) > (bestQualityRec.quality ?? 0)) {
        bestQualityRec = item;
      }
    }
    if (!bestQualityRec.reasons.some((r) => r.code === 'best-quality-in-budget')) {
      bestQualityRec.reasons.push({ code: 'best-quality-in-budget' });
    }
  }

  return selected;
}
