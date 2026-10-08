import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Badge, Card, CardContent, CardHeader } from '../../components/ui';
import { useAppData } from '../../data/AppData';
import { useMoney } from '../../data/hooks';
import {
  apiEquivalentUsd,
  capacityTasks,
  coverage,
  leverage,
  limitSummary,
  planPrice,
} from '../../domain/subscriptions';
import { selectOffer, taskFromProfile, tasksForBudget } from '../../domain/pricing';
import { buildCompareHref, getStoredCompareRefs } from '../compare/compareItems';
import type { ModelEntry, PriceOffer, SubscriptionPlan, UsageProfile } from '../../domain/types';

export interface SubscriptionCardProps {
  plan: SubscriptionPlan;
  profile: UsageProfile;
  activeHoursPerDay: number;
  isSelectedForChart: boolean;
  onToggleChartSelect: (planId: string) => void;
  bestValueModel?: { model: ModelEntry; offer: PriceOffer };
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  plan,
  profile,
  activeHoursPerDay,
  isSelectedForChart,
  onToggleChartSelect,
  bestValueModel,
}) => {
  const { t, i18n } = useTranslation('subscriptions');
  const { models, fx } = useAppData();
  const { fmt, currency, isVatApplied } = useMoney();

  const lang = i18n.language?.startsWith('pl') ? 'pl' : 'en';
  const workDaysPerMonth = profile.workDaysPerMonth || 20;
  const demandTasks = profile.tasksPerDay * workDaysPerMonth;

  // Find primary model
  const primaryModel = models.find((m) => m.id === plan.primaryModelId);
  const task = taskFromProfile(profile);
  const primaryOffer = primaryModel
    ? selectOffer(primaryModel, task, { includeFree: false, includeBatch: false })
    : undefined;

  // Price calculations
  const priceInfo = planPrice(plan, currency, fx, isVatApplied ? 23 : 0);
  const priceUsd = plan.priceUsdMonthly;

  // Capacity & Coverage
  const cap = capacityTasks(plan, profile, primaryOffer, {
    activeHoursPerDay,
    workDaysPerMonth,
  });
  const cov = coverage(cap, demandTasks);
  const apiEqUsd = apiEquivalentUsd(plan, primaryOffer, {
    activeHoursPerDay,
    workDaysPerMonth,
  });
  const lev = leverage(apiEqUsd, priceUsd);

  // Limit summary
  const summaryInfo = limitSummary(plan);
  const unitText = plan.unitLabel[lang] || plan.unitLabel.en;

  // Days since verification
  const verifiedDate = new Date(plan.lastVerified);
  const daysOld = Math.floor((Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));
  const isOutdated = daysOld > 45 || Number.isNaN(daysOld);

  // Confidence badge color
  const confidenceVariant =
    plan.confidence === 'official'
      ? 'success'
      : plan.confidence === 'reported'
        ? 'warning'
        : 'neutral';

  // Included models
  const includedModelsData = plan.includedModelIds.slice(0, 4).map((id) => {
    const found = models.find((m) => m.id === id);
    return {
      id,
      name: found ? found.name : id.split('/').pop() || id,
      tier: found?.quality.tier,
      isUnknown: !found,
    };
  });

  // Same money on API
  const primaryTasks =
    primaryOffer && primaryOffer.inputPerMTok >= 0
      ? tasksForBudget(priceUsd, task, primaryOffer)
      : null;
  const bestTasks =
    bestValueModel && bestValueModel.offer.inputPerMTok >= 0
      ? tasksForBudget(priceUsd, task, bestValueModel.offer)
      : null;

  const compareHref = buildCompareHref(getStoredCompareRefs(), { kind: 'plan', id: plan.id });

  return (
    <Card className="flex flex-col justify-between h-full border-zinc-200 dark:border-zinc-800">
      <div>
        <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                {plan.providerName}
              </p>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-display">
                {plan.name}
              </h3>
            </div>
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1">
                {!priceInfo.isLocalList && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">≈</span>
                )}
                <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
                  {fmt(priceUsd)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  /{lang === 'pl' ? 'mies' : 'mo'}
                </span>
              </div>
              {priceInfo.isLocalList && (
                <span className="inline-block text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  ({t('card.listPrice')})
                </span>
              )}
              {plan.annualPriceUsdMonthly && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {t('card.annual', { price: fmt(plan.annualPriceUsdMonthly) })}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <Badge variant={confidenceVariant}>{t(`confidence.${plan.confidence}`)}</Badge>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                isOutdated
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80'
              }`}
            >
              {isOutdated ? t('card.outdated') : t('card.verified', { date: plan.lastVerified })}
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4 text-xs">
          {/* Features */}
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t('card.features')}
            </p>
            <div className="flex flex-wrap gap-1">
              {plan.features.codingAgents.map((agent) => (
                <span
                  key={agent}
                  className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium"
                >
                  🤖 {agent}
                </span>
              ))}
              {plan.features.imageGeneration && (
                <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  🎨 {t('featureNames.imageGeneration')}
                </span>
              )}
              {plan.features.deepResearch && (
                <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  🔬 {t('featureNames.deepResearch')}
                </span>
              )}
              {plan.features.apiAccess && (
                <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  ⚡ {t('featureNames.apiAccess')}
                </span>
              )}
              {plan.features.longContextTokens && (
                <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  📖{' '}
                  {t('featureNames.longContext', {
                    tokens: plan.features.longContextTokens.toLocaleString(),
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Included Models */}
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t('card.includedModels')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {includedModelsData.map((m) => (
                <span
                  key={m.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
                    m.isUnknown
                      ? 'border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  <span>{m.name}</span>
                  {m.tier && (
                    <span className="font-bold text-[10px] px-1 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                      {m.tier}
                    </span>
                  )}
                  {m.isUnknown && (
                    <span className="italic text-[10px] text-zinc-400">
                      ({t('card.unknownModel')})
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Limits */}
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {t('card.limits')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t(summaryInfo.key, { ...summaryInfo.params, unit: unitText })}
            </p>
          </div>

          {/* Capacity & Coverage */}
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {t('card.capacity')}
            </p>
            {cap && cov ? (
              <div className="space-y-1.5">
                <p className="font-bold text-zinc-900 dark:text-zinc-100">
                  {t('card.capacityVal', {
                    low: cap.low.toLocaleString(),
                    high: cap.high.toLocaleString(),
                  })}
                </p>
                <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden relative">
                  <div
                    className="absolute top-0 bottom-0 bg-indigo-500/30 dark:bg-indigo-500/40 rounded-full"
                    style={{
                      left: `${cov.low * 100}%`,
                      width: `${Math.max(2, (cov.high - cov.low) * 100)}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 bg-indigo-600 dark:bg-indigo-400 rounded-full"
                    style={{ width: `${cov.low * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t('card.coverage', { pct: Math.round(cov.low * 100) })}
                  {cov.high > cov.low && `–${Math.round(cov.high * 100)}%`}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-zinc-500 dark:text-zinc-400 italic">{t('card.unknownLimit')}</p>
                <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800/60 rounded-full" />
              </div>
            )}
          </div>

          {/* Value / Leverage */}
          {!primaryModel ? (
            <p className="text-amber-600 dark:amber-400 italic font-medium">
              ⚠️ {t('card.missingPrimary')}
            </p>
          ) : (
            apiEqUsd &&
            lev && (
              <div>
                <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('card.value')}
                </p>
                <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {t('card.valueVal', {
                    apiEqLow: fmt(apiEqUsd.low),
                    apiEqHigh: fmt(apiEqUsd.high),
                    levLow: lev.low.toFixed(1),
                    levHigh: lev.high.toFixed(1),
                  })}
                </p>
              </div>
            )
          )}

          {/* Same Money on API */}
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              {t('card.sameMoneyApi')}
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              {primaryTasks !== null ? primaryTasks.toLocaleString() : '—'}{' '}
              {lang === 'pl' ? 'zadań na' : 'tasks on'}{' '}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {primaryModel?.name ?? plan.primaryModelId}
              </span>
              {bestValueModel && bestTasks !== null && (
                <span>
                  , {bestTasks.toLocaleString()} {lang === 'pl' ? 'na' : 'on'}{' '}
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {bestValueModel.model.name}
                  </span>
                </span>
              )}
            </p>
          </div>

          {/* Notes */}
          {plan.notes[lang] && (
            <p className="text-zinc-500 dark:text-zinc-400 italic text-[11px] pt-1">
              {plan.notes[lang]}
            </p>
          )}

          {/* Sources */}
          {plan.sources.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[11px] pt-1">
              {plan.sources.map((src) => (
                <a
                  key={src.url}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline"
                >
                  {src.label} ↗
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </div>

      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 px-6 pb-4 flex items-center justify-between text-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={isSelectedForChart}
            onChange={() => onToggleChartSelect(plan.id)}
            aria-label={t('card.selectChartPlan', { plan: `${plan.providerName} ${plan.name}` })}
            className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
          />
          <span>{t('card.selectChart')}</span>
        </label>

        <Link
          to={compareHref}
          className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold"
        >
          {t('card.compareLink')} →
        </Link>
      </div>
    </Card>
  );
};
