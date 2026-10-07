import type {
  ChannelFee,
  Currency,
  FxRates,
  ModelEntry,
  SubscriptionPlan,
  UsageProfile,
} from '../../domain/types';
import { costPerTask, monthlyCost, selectOffer, taskFromProfile } from '../../domain/pricing';
import { qualityScore } from '../../domain/quality';
import { capacityTasks, coverage, planPrice } from '../../domain/subscriptions';
import { applyVat, convertFromUsd, formatMoney } from '../../domain/currency';

export interface CompareRef {
  kind: 'model' | 'plan';
  id: string;
}

export function parseItems(param: string[]): CompareRef[] {
  const result: CompareRef[] = [];
  const seen = new Set<string>();

  for (const rawItem of param) {
    if (!rawItem) continue;
    const tokens = rawItem.split(',');
    for (const token of tokens) {
      const trimmed = token.trim();
      if (!trimmed) continue;

      let kind: 'model' | 'plan' | undefined;
      let id = '';

      if (trimmed.startsWith('m:')) {
        kind = 'model';
        id = trimmed.slice(2);
      } else if (trimmed.startsWith('s:')) {
        kind = 'plan';
        id = trimmed.slice(2);
      }

      if (!kind || !id) continue;

      const key = `${kind}:${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ kind, id });
        if (result.length >= 4) {
          return result;
        }
      }
    }
  }

  return result;
}

export function serializeItems(refs: CompareRef[]): string[] {
  return refs.map((ref) => `${ref.kind === 'model' ? 'm:' : 's:'}${ref.id}`);
}

export function buildCompareHref(existingRefs: CompareRef[], add: CompareRef): string {
  const isAlreadyPresent = existingRefs.some((r) => r.kind === add.kind && r.id === add.id);

  let newRefs: CompareRef[];
  if (isAlreadyPresent) {
    newRefs = existingRefs;
  } else if (existingRefs.length < 4) {
    newRefs = [...existingRefs, add];
  } else {
    newRefs = [...existingRefs.slice(0, 3), add];
  }

  const tokens = serializeItems(newRefs);
  return `/compare?items=${encodeURIComponent(tokens.join(','))}`;
}

export const COMPARE_STORAGE_KEY = 'tpa-compare-last';

const memoryStore: Record<string, string> = {};

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return memoryStore[key] ?? null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // ignore
  }
  memoryStore[key] = value;
}

export function getStoredCompareRefs(): CompareRef[] {
  try {
    const raw = getStorageItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    if (raw.startsWith('[')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parseItems(parsed);
      }
    }
    return parseItems([raw]);
  } catch {
    return [];
  }
}

export function setStoredCompareRefs(refs: CompareRef[]): void {
  try {
    const tokens = serializeItems(refs);
    setStorageItem(COMPARE_STORAGE_KEY, tokens.join(','));
  } catch {
    // ignore
  }
}

export function clearStoredCompareRefs(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(COMPARE_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  delete memoryStore[COMPARE_STORAGE_KEY];
}

export interface CompareCell {
  value: string;
  numericValue?: number;
  rawValue?: unknown;
  isBest?: boolean;
  isWorst?: boolean;
}

export interface CompareRow {
  key: string;
  better?: 'higher' | 'lower';
  cells: Record<string, CompareCell>;
}

export interface CompareDataInput {
  models: ModelEntry[];
  subscriptions: SubscriptionPlan[];
  fees: ChannelFee[];
}

export interface CompareSettingsInput {
  currency: Currency;
  fx: FxRates;
  isVatApplied: boolean;
  activeHoursPerDay: number;
  snapshotDate?: string;
}

export function buildCompareRows(
  refs: CompareRef[],
  data: CompareDataInput,
  profile: UsageProfile,
  settings: CompareSettingsInput,
  locale = 'en',
): CompareRow[] {
  const task = taskFromProfile(profile);
  const workDays = profile.workDaysPerMonth || 20;
  const demandTasks = profile.tasksPerDay * workDays;
  const vatPct = settings.isVatApplied ? 23 : 0;

  const itemKeys = refs.map((r) => `${r.kind}:${r.id}`);

  // Helper to convert USD amount to local currency with VAT
  const toLocalMoney = (amountUsd: number) => {
    const converted = convertFromUsd(amountUsd, settings.currency, settings.fx);
    return applyVat(converted, vatPct);
  };

  const fmtMoney = (amountUsd: number) => {
    const localVal = toLocalMoney(amountUsd);
    return formatMoney(localVal, settings.currency, locale);
  };

  const rows: {
    key: string;
    better?: 'higher' | 'lower';
    cells: Record<string, CompareCell>;
  }[] = [
    { key: 'type', cells: {} },
    { key: 'provider', cells: {} },
    { key: 'listPrice', cells: {} },
    { key: 'costPerTask', better: 'lower', cells: {} },
    { key: 'monthlyCost', better: 'lower', cells: {} },
    { key: 'capacityCoverage', better: 'higher', cells: {} },
    { key: 'quality', better: 'higher', cells: {} },
    { key: 'contextWindow', better: 'higher', cells: {} },
    { key: 'speed', better: 'higher', cells: {} },
    { key: 'features', cells: {} },
    { key: 'dataConfidence', cells: {} },
    { key: 'lastUpdated', cells: {} },
  ];

  const rowMap = new Map(rows.map((r) => [r.key, r]));

  for (const ref of refs) {
    const itemKey = `${ref.kind}:${ref.id}`;

    if (ref.kind === 'model') {
      const model = data.models.find((m) => m.id === ref.id);
      if (!model) {
        for (const row of rows) {
          row.cells[itemKey] = { value: '—' };
        }
        continue;
      }

      const offer = selectOffer(model, task, { includeFree: true, includeBatch: false });
      const cTask = offer ? costPerTask(task, offer) : undefined;
      const mCost = offer ? monthlyCost(profile, offer) : undefined;
      const qVal = qualityScore(model, profile.qualityDimension) ?? model.quality.intelligence;

      // Type
      rowMap.get('type')!.cells[itemKey] = {
        value: 'Model (API)',
        rawValue: 'model',
      };

      // Provider
      rowMap.get('provider')!.cells[itemKey] = {
        value: model.providerName,
        rawValue: model.provider,
      };

      // List price
      if (offer) {
        const listStr = offer.isFree
          ? 'Free'
          : `In: ${fmtMoney(offer.inputPerMTok)} / Out: ${fmtMoney(offer.outputPerMTok)} per 1M`;
        rowMap.get('listPrice')!.cells[itemKey] = { value: listStr, rawValue: offer };
      } else {
        rowMap.get('listPrice')!.cells[itemKey] = { value: '—' };
      }

      // Cost per task
      if (cTask !== undefined) {
        rowMap.get('costPerTask')!.cells[itemKey] = {
          value: fmtMoney(cTask),
          numericValue: toLocalMoney(cTask),
        };
      } else {
        rowMap.get('costPerTask')!.cells[itemKey] = { value: '—' };
      }

      // Monthly cost
      if (mCost !== undefined) {
        rowMap.get('monthlyCost')!.cells[itemKey] = {
          value: fmtMoney(mCost),
          numericValue: toLocalMoney(mCost),
        };
      } else {
        rowMap.get('monthlyCost')!.cells[itemKey] = { value: '—' };
      }

      // Capacity / coverage
      rowMap.get('capacityCoverage')!.cells[itemKey] = {
        value: 'Unlimited (API) · 100%',
        numericValue: 100,
      };

      // Quality & Tier
      const tierStr = model.quality.tier ? `Tier ${model.quality.tier}` : '';
      const qualityStr = `${tierStr ? `${tierStr} · ` : ''}${qVal ? Math.round(qVal) : '—'} pts`;
      rowMap.get('quality')!.cells[itemKey] = {
        value: qualityStr,
        numericValue: qVal,
      };

      // Context window
      const ctxTok = model.contextLength;
      const ctxStr = ctxTok ? `${(ctxTok / 1000).toLocaleString(locale)}k tokens` : '—';
      rowMap.get('contextWindow')!.cells[itemKey] = {
        value: ctxStr,
        numericValue: ctxTok,
      };

      // Speed
      const speedVal = model.speed?.outputTokensPerSecond;
      const ttftVal = model.speed?.timeToFirstTokenSeconds;
      const speedStr = speedVal
        ? `${Math.round(speedVal)} tok/s${ttftVal !== undefined ? ` (TTFT ${ttftVal.toFixed(2)}s)` : ''}`
        : '—';
      rowMap.get('speed')!.cells[itemKey] = {
        value: speedStr,
        numericValue: speedVal,
      };

      // Features
      const featureList: string[] = [];
      if (model.openWeights) featureList.push('Open weights');
      if (model.capabilities?.imageInput) featureList.push('Image input');
      if (model.capabilities?.tools) featureList.push('Tools');
      rowMap.get('features')!.cells[itemKey] = {
        value: featureList.length > 0 ? featureList.join(', ') : '—',
      };

      // Data confidence & source
      const confStr = 'Official (OpenRouter)';
      rowMap.get('dataConfidence')!.cells[itemKey] = {
        value: confStr,
      };

      // Last updated
      rowMap.get('lastUpdated')!.cells[itemKey] = {
        value: settings.snapshotDate || 'Latest',
      };
    } else {
      // Plan
      const plan = data.subscriptions.find((p) => p.id === ref.id);
      if (!plan) {
        for (const row of rows) {
          row.cells[itemKey] = { value: '—' };
        }
        continue;
      }

      const primaryModel = data.models.find((m) => m.id === plan.primaryModelId);
      const primaryOffer = primaryModel
        ? selectOffer(primaryModel, task, { includeFree: false, includeBatch: false })
        : undefined;

      const pPrice = planPrice(plan, settings.currency, settings.fx, vatPct);
      const cap = capacityTasks(plan, profile, primaryOffer, {
        activeHoursPerDay: settings.activeHoursPerDay,
        workDaysPerMonth: workDays,
      });
      const cov = coverage(cap, demandTasks);

      // Type
      rowMap.get('type')!.cells[itemKey] = {
        value: 'Subscription plan',
        rawValue: 'plan',
      };

      // Provider
      rowMap.get('provider')!.cells[itemKey] = {
        value: plan.providerName,
      };

      // List price
      const priceStr = `${formatMoney(pPrice.amount, settings.currency, locale)} / mo`;
      rowMap.get('listPrice')!.cells[itemKey] = {
        value: priceStr,
      };

      // Cost per task
      if (cap && cap.low > 0) {
        const costLowUsd = plan.priceUsdMonthly / cap.high;
        const costHighUsd = plan.priceUsdMonthly / cap.low;
        const costLowLocal = toLocalMoney(costLowUsd);
        const costHighLocal = toLocalMoney(costHighUsd);
        const avgCostLocal = (costLowLocal + costHighLocal) / 2;

        const costTaskStr = `${formatMoney(costLowLocal, settings.currency, locale)} – ${formatMoney(costHighLocal, settings.currency, locale)}`;
        rowMap.get('costPerTask')!.cells[itemKey] = {
          value: costTaskStr,
          numericValue: avgCostLocal,
        };
      } else {
        rowMap.get('costPerTask')!.cells[itemKey] = { value: '—' };
      }

      // Monthly cost
      rowMap.get('monthlyCost')!.cells[itemKey] = {
        value: formatMoney(pPrice.amount, settings.currency, locale),
        numericValue: pPrice.amount,
      };

      // Capacity / coverage
      if (cap && cov) {
        const covLowPct = Math.round(cov.low * 100);
        const covHighPct = Math.round(cov.high * 100);
        const covStr = `${cap.low.toLocaleString(locale)} – ${cap.high.toLocaleString(locale)} tasks (${covLowPct}%${covHighPct > covLowPct ? `–${covHighPct}%` : ''})`;
        rowMap.get('capacityCoverage')!.cells[itemKey] = {
          value: covStr,
          numericValue: (cov.low + cov.high) * 50,
        };
      } else {
        rowMap.get('capacityCoverage')!.cells[itemKey] = { value: '—' };
      }

      // Quality & Tier
      const primaryQ = primaryModel
        ? (qualityScore(primaryModel, profile.qualityDimension) ??
          primaryModel.quality.intelligence)
        : undefined;
      const tierStr = primaryModel?.quality.tier ? `Tier ${primaryModel.quality.tier}` : '';
      const qualityStr = primaryQ
        ? `${tierStr ? `${tierStr} · ` : ''}${Math.round(primaryQ)} pts`
        : '—';
      rowMap.get('quality')!.cells[itemKey] = {
        value: qualityStr,
        numericValue: primaryQ,
      };

      // Context window
      const ctxTok = primaryModel?.contextLength || plan.features.longContextTokens;
      const ctxStr = ctxTok ? `${(ctxTok / 1000).toLocaleString(locale)}k tokens` : '—';
      rowMap.get('contextWindow')!.cells[itemKey] = {
        value: ctxStr,
        numericValue: ctxTok,
      };

      // Speed
      const speedVal = primaryModel?.speed?.outputTokensPerSecond;
      const ttftVal = primaryModel?.speed?.timeToFirstTokenSeconds;
      const speedStr = speedVal
        ? `${Math.round(speedVal)} tok/s${ttftVal !== undefined ? ` (TTFT ${ttftVal.toFixed(2)}s)` : ''}`
        : '—';
      rowMap.get('speed')!.cells[itemKey] = {
        value: speedStr,
        numericValue: speedVal,
      };

      // Features
      const featureList: string[] = [];
      if (plan.features.codingAgents.length > 0)
        featureList.push(`Agents: ${plan.features.codingAgents.join(', ')}`);
      if (plan.features.imageGeneration) featureList.push('Image gen');
      if (plan.features.deepResearch) featureList.push('Deep research');
      if (plan.features.apiAccess) featureList.push('API access');
      rowMap.get('features')!.cells[itemKey] = {
        value: featureList.length > 0 ? featureList.join(', ') : '—',
      };

      // Data confidence & source
      const confLabel =
        plan.confidence === 'official'
          ? 'Official'
          : plan.confidence === 'reported'
            ? 'Reported'
            : 'Estimated';
      rowMap.get('dataConfidence')!.cells[itemKey] = {
        value: `${confLabel} (${plan.sources.length} sources)`,
      };

      // Last updated
      rowMap.get('lastUpdated')!.cells[itemKey] = {
        value: plan.lastVerified,
      };
    }
  }

  // Evaluate best / worst flags for numeric rows with >= 2 comparable items
  for (const row of rows) {
    if (!row.better) continue;

    const numericCells = itemKeys
      .map((key) => ({ key, cell: row.cells[key] }))
      .filter(
        (item): item is { key: string; cell: CompareCell & { numericValue: number } } =>
          item.cell !== undefined &&
          item.cell.numericValue !== undefined &&
          !Number.isNaN(item.cell.numericValue),
      );

    if (numericCells.length < 2) continue;

    const values = numericCells.map((item) => item.cell.numericValue);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    if (minVal === maxVal) continue;

    const bestVal = row.better === 'higher' ? maxVal : minVal;
    const worstVal = row.better === 'higher' ? minVal : maxVal;

    for (const { cell } of numericCells) {
      if (cell.numericValue === bestVal) {
        cell.isBest = true;
      } else if (cell.numericValue === worstVal) {
        cell.isWorst = true;
      }
    }
  }

  return rows;
}
