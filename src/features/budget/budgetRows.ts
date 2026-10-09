import {
  costPerTask,
  generationSecondsPerTask,
  monthlyTasks,
  selectOffer,
  taskFromProfile,
  tasksForBudget,
  tokensForBudget,
  usableCredit,
  workDaysForBudget,
} from '../../domain/pricing';
import { meetsMinTier, paretoFrontier } from '../../domain/quality';
import type {
  ChannelFee,
  ModelEntry,
  PriceOffer,
  QualityTier,
  UsageProfile,
} from '../../domain/types';

export interface BuildBudgetRowsOptions {
  models: ModelEntry[];
  profile: UsageProfile;
  budgetUsd: number;
  fees: ChannelFee[];
  includeFree: boolean;
  includeBatch: boolean;
  applyFees: boolean;
}

export interface BudgetRow {
  model: ModelEntry;
  offer: PriceOffer;
  fee?: ChannelFee;
  credit: number;
  belowMinTopUp: boolean;
  costPerTask: number;
  tasks: number;
  workDays: number;
  coverageOfMonth: number;
  tokens: {
    inputTokens: number;
    outputTokens: number;
  };
  generationHours: number | null;
  quality: number | undefined;
  tier: QualityTier;
  isPareto: boolean;
  isFree: boolean;
  rateLimited: boolean;
}

export function buildBudgetRows(opts: BuildBudgetRowsOptions): BudgetRow[] {
  const { models, profile, budgetUsd, fees, includeFree, includeBatch, applyFees } = opts;
  const task = taskFromProfile(profile);
  const mTasks = monthlyTasks(profile);

  // 1. Gather initial model rows with eligible offers
  const candidateRows: Omit<BudgetRow, 'isPareto'>[] = [];

  for (const model of models) {
    const offer = selectOffer(model, task, { includeFree, includeBatch });
    if (!offer) {
      continue;
    }

    const fee = offer.channel.startsWith('openrouter')
      ? fees.find((f) => f.vendor === 'openrouter')
      : fees.find((f) => f.vendor === offer.vendor);

    const isBelowMin = Boolean(applyFees && fee && budgetUsd > 0 && budgetUsd < fee.minTopUpUsd);
    const credit = applyFees ? usableCredit(budgetUsd, fee) : budgetUsd;

    const isFree = Boolean(offer.isFree || offer.channel === 'openrouter-free');
    const rateLimited = isFree;

    const cPerTask = costPerTask(task, offer);
    // A Budget result must be useful for the active profile. In particular, a
    // coding or agentic profile should not be filled with models that only have
    // a generic intelligence score (for example translation-only models).
    const quality = model.quality[profile.qualityDimension];
    if (quality === undefined) {
      continue;
    }
    const tier: QualityTier = model.quality.tier ?? 'C';

    let tasks: number;
    let workDays: number;
    let coverageOfMonth: number;
    let tokens: { inputTokens: number; outputTokens: number };
    let generationHours: number | null;

    if (isFree) {
      tasks = Number.POSITIVE_INFINITY;
      workDays = Number.POSITIVE_INFINITY;
      coverageOfMonth = 1;
      tokens = {
        inputTokens: Number.POSITIVE_INFINITY,
        outputTokens: Number.POSITIVE_INFINITY,
      };
      const genSecs = generationSecondsPerTask(task, model.speed);
      generationHours = genSecs !== null ? Number.POSITIVE_INFINITY : null;
    } else {
      tasks = tasksForBudget(credit, task, offer);
      workDays = workDaysForBudget(credit, profile, offer);
      coverageOfMonth = mTasks > 0 ? Math.min(1, tasks / mTasks) : 0;
      tokens = tokensForBudget(credit, task, offer);
      const genSecs = generationSecondsPerTask(task, model.speed);
      generationHours = genSecs !== null ? (tasks * genSecs) / 3600 : null;
    }

    candidateRows.push({
      model,
      offer,
      fee,
      credit,
      belowMinTopUp: isBelowMin,
      costPerTask: cPerTask,
      tasks,
      workDays,
      coverageOfMonth,
      tokens,
      generationHours,
      quality,
      tier,
      isFree,
      rateLimited,
    });
  }

  // 2. Compute Pareto frontier (cost per task vs quality)
  const paretoPoints = candidateRows.map((r) => ({
    id: r.model.id,
    cost: r.costPerTask,
    quality: r.quality,
  }));
  const paretoSet = paretoFrontier(paretoPoints);

  return candidateRows.map((row) => ({
    ...row,
    isPareto: paretoSet.has(row.model.id),
  }));
}

export interface HighlightResults {
  bestQualityFullMonth?: BudgetRow;
  cheapestAcceptable?: BudgetRow;
  bestValue?: BudgetRow;
}

export function pickHighlights(rows: BudgetRow[], minTier: QualityTier): HighlightResults {
  if (rows.length === 0) {
    return {};
  }

  // 1. bestQualityFullMonth: highest quality with coverageOfMonth === 1
  const fullMonthRows = rows.filter((r) => r.coverageOfMonth === 1 && r.quality !== undefined);
  let bestQualityFullMonth: BudgetRow | undefined;
  for (const r of fullMonthRows) {
    if (!bestQualityFullMonth) {
      bestQualityFullMonth = r;
      continue;
    }
    const currentQ = bestQualityFullMonth.quality ?? 0;
    const candidateQ = r.quality ?? 0;
    if (candidateQ > currentQ) {
      bestQualityFullMonth = r;
    } else if (candidateQ === currentQ) {
      if (r.workDays > bestQualityFullMonth.workDays) {
        bestQualityFullMonth = r;
      }
    }
  }

  // 2. cheapestAcceptable: most work days among tier >= minTier
  const acceptableRows = rows.filter((r) => meetsMinTier(r.tier, minTier));
  let cheapestAcceptable: BudgetRow | undefined;
  for (const r of acceptableRows) {
    if (!cheapestAcceptable) {
      cheapestAcceptable = r;
      continue;
    }
    if (r.workDays > cheapestAcceptable.workDays) {
      cheapestAcceptable = r;
    } else if (r.workDays === cheapestAcceptable.workDays) {
      if ((r.quality ?? 0) > (cheapestAcceptable.quality ?? 0)) {
        cheapestAcceptable = r;
      }
    }
  }

  // 3. bestValue: Pareto row with tier >= minTier that has the highest coverageOfMonth, ties going to higher quality
  const paretoAcceptable = rows.filter((r) => r.isPareto && meetsMinTier(r.tier, minTier));
  let bestValue: BudgetRow | undefined;
  for (const r of paretoAcceptable) {
    if (!bestValue) {
      bestValue = r;
      continue;
    }
    if (r.coverageOfMonth > bestValue.coverageOfMonth) {
      bestValue = r;
    } else if (r.coverageOfMonth === bestValue.coverageOfMonth) {
      if ((r.quality ?? 0) > (bestValue.quality ?? 0)) {
        bestValue = r;
      }
    }
  }

  return {
    bestQualityFullMonth,
    cheapestAcceptable,
    bestValue,
  };
}
