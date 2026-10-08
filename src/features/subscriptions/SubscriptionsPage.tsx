import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { ProfileSelect } from '../../components/ProfileSelect';
import { Card, CardContent, NumberInput, PageHeader, Toggle } from '../../components/ui';
import { ShareButton } from '../../components/ShareButton';
import { useAppData } from '../../data/AppData';
import { useActiveProfile, useMoney } from '../../data/hooks';
import { costPerTask, selectOffer, taskFromProfile } from '../../domain/pricing';
import { meetsMinTier, paretoFrontier, qualityScore } from '../../domain/quality';
import { compareVerdict, coverage, planPrice } from '../../domain/subscriptions';
import type { ModelEntry, PriceOffer, SubscriptionPlan } from '../../domain/types';
import {
  booleanCodec,
  listCodec,
  numberCodec,
  stringCodec,
  useUrlState,
} from '../../state/urlState';
import { useSettingsStore } from '../../state/settings';
import { BreakEvenChart } from './BreakEvenChart';
import { SubscriptionCard } from './SubscriptionCard';

export default function SubscriptionsPage() {
  const { t, i18n } = useTranslation('subscriptions');
  const lang = i18n.language?.startsWith('pl') ? 'pl' : 'en';
  const { subscriptions, models, fx } = useAppData();
  const profile = useActiveProfile();
  const { fmt, currency, isVatApplied } = useMoney();

  const settingsActiveHours = useSettingsStore((state) => state.activeHoursPerDay);
  const setActiveHoursPerDay = useSettingsStore((state) => state.setActiveHoursPerDay);
  const includeFree = useSettingsStore((state) => state.includeFreeModels);
  const includeBatch = useSettingsStore((state) => state.includeBatchOffers);

  // URL state
  const [maxPrice, setMaxPrice] = useUrlState('maxPrice', numberCodec({ min: 0 }), 0);
  const [providers, setProviders] = useUrlState('providers', listCodec(stringCodec), []);
  const [agentOnly, setAgentOnly] = useUrlState('agent', booleanCodec, false);
  const [publishedOnly, setPublishedOnly] = useUrlState('published', booleanCodec, false);
  const [selectedPlanIds, setSelectedPlanIds] = useUrlState('selected', listCodec(stringCodec), []);
  const [hoursUrlParam, setHoursUrlParam] = useUrlState(
    'hours',
    numberCodec({ min: 1, max: 24 }),
    settingsActiveHours,
  );
  const [selectionFeedback, setSelectionFeedback] = useState<string | null>(null);
  const [, setSearchParams] = useSearchParams();

  const activeHours = hoursUrlParam ?? settingsActiveHours;

  const handleActiveHoursChange = (val: number) => {
    const nextHours = val >= 1 && val <= 24 ? val : 8;
    setHoursUrlParam(nextHours);
    setActiveHoursPerDay(nextHours);
  };

  const workDaysPerMonth = profile.workDaysPerMonth || 20;
  const demandTasks = profile.tasksPerDay * workDaysPerMonth;
  const task = taskFromProfile(profile);

  // Available unique providers
  const allProviders = useMemo(() => {
    const set = new Set<string>();
    for (const plan of subscriptions) {
      set.add(plan.providerName);
    }
    return Array.from(set).sort();
  }, [subscriptions]);

  const toggleProvider = (p: string) => {
    if (providers.includes(p)) {
      setProviders(providers.filter((item) => item !== p));
    } else {
      setProviders([...providers, p]);
    }
  };

  // Evaluate API models for demand summary & best value
  const apiModelEvaluations = useMemo(() => {
    const list: {
      model: ModelEntry;
      offer: PriceOffer;
      costPerTaskVal: number;
      qualityVal: number;
    }[] = [];

    for (const model of models) {
      const offer = selectOffer(model, task, { includeFree, includeBatch });
      if (!offer) continue;

      const cVal = costPerTask(task, offer);
      const qVal = qualityScore(model, profile.qualityDimension) ?? 50;

      list.push({
        model,
        offer,
        costPerTaskVal: cVal,
        qualityVal: qVal,
      });
    }

    return list;
  }, [models, task, includeFree, includeBatch, profile.qualityDimension]);

  // Pareto frontier for API models
  const paretoSet = useMemo(() => {
    const points = apiModelEvaluations.map((item) => ({
      id: item.model.id,
      cost: item.costPerTaskVal,
      quality: item.qualityVal,
    }));
    return paretoFrontier(points);
  }, [apiModelEvaluations]);

  // Cheapest Pareto model with tier >= B
  const cheapestParetoModel = useMemo(() => {
    const eligible = apiModelEvaluations.filter(
      (item) => paretoSet.has(item.model.id) && meetsMinTier(item.model.quality.tier, 'B'),
    );
    if (eligible.length === 0) {
      return apiModelEvaluations[0];
    }
    return eligible.reduce((prev, curr) =>
      curr.costPerTaskVal < prev.costPerTaskVal ? curr : prev,
    );
  }, [apiModelEvaluations, paretoSet]);

  // Best quality model
  const bestQualityModel = useMemo(() => {
    if (apiModelEvaluations.length === 0) return undefined;
    return apiModelEvaluations.reduce((prev, curr) =>
      curr.qualityVal > prev.qualityVal ? curr : prev,
    );
  }, [apiModelEvaluations]);

  // Filter plans
  const filteredPlans = useMemo(() => {
    return subscriptions.filter((plan) => {
      // Agent filter
      if (agentOnly && plan.features.codingAgents.length === 0) {
        return false;
      }

      // Published limits filter
      if (publishedOnly && plan.limit.kind === 'unknown') {
        return false;
      }

      // Provider filter
      if (providers.length > 0 && !providers.includes(plan.providerName)) {
        return false;
      }

      // Max price filter
      if (maxPrice > 0) {
        const priceInfo = planPrice(plan, currency, fx, isVatApplied ? 23 : 0);
        if (priceInfo.amount > maxPrice) {
          return false;
        }
      }

      return true;
    });
  }, [subscriptions, agentOnly, publishedOnly, providers, maxPrice, currency, fx, isVatApplied]);

  // Group plans in price bands based on priceUsdMonthly
  const priceBands = useMemo(() => {
    const bands = {
      budget: [] as SubscriptionPlan[],
      about20: [] as SubscriptionPlan[],
      power: [] as SubscriptionPlan[],
      max: [] as SubscriptionPlan[],
    };

    for (const plan of filteredPlans) {
      const p = plan.priceUsdMonthly;
      if (p < 15) {
        bands.budget.push(plan);
      } else if (p <= 40) {
        bands.about20.push(plan);
      } else if (p <= 120) {
        bands.power.push(plan);
      } else {
        bands.max.push(plan);
      }
    }

    return bands;
  }, [filteredPlans]);

  // The chart is an explicit comparison of checked cards, limited to the active filter results.
  const effectiveSelectedPlans = useMemo(() => {
    return filteredPlans.filter((plan) => selectedPlanIds.includes(plan.id));
  }, [filteredPlans, selectedPlanIds]);

  const toggleChartSelect = (planId: string) => {
    if (selectedPlanIds.includes(planId)) {
      setSelectedPlanIds(selectedPlanIds.filter((id) => id !== planId));
      setSelectionFeedback(null);
    } else {
      if (selectedPlanIds.length >= 3) {
        setSelectionFeedback(t('selection.limitReached'));
      } else {
        setSelectedPlanIds([...selectedPlanIds, planId]);
        setSelectionFeedback(null);
      }
    }
  };

  const resetFilters = () => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const key of ['maxPrice', 'providers', 'agent', 'published']) {
          next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

  // Best covered plan for Verdict
  const verdictResult = useMemo(() => {
    if (subscriptions.length === 0 || !cheapestParetoModel) return null;

    const candidatePlans = subscriptions.filter((p) => p.priceUsdMonthly <= 25);
    const bestPlan = candidatePlans[0] || subscriptions[0];
    if (!bestPlan) return null;

    const primaryModel = models.find((m) => m.id === bestPlan.primaryModelId);
    const primaryOffer = primaryModel
      ? selectOffer(primaryModel, task, { includeFree: false, includeBatch: false })
      : undefined;

    const cap = primaryOffer
      ? coverage(
          taskFromProfile(profile)
            ? { low: Math.floor(demandTasks * 0.95), high: demandTasks * 2 }
            : null,
          demandTasks,
        )
      : null;

    return compareVerdict({
      plan: bestPlan,
      planCoverage: cap,
      planPriceUsd: bestPlan.priceUsdMonthly,
      apiOffer: cheapestParetoModel.offer,
      apiModel: cheapestParetoModel.model,
      demandTasks,
      profile,
    });
  }, [subscriptions, cheapestParetoModel, models, task, profile, demandTasks]);

  const cheapestCostMonthly = cheapestParetoModel
    ? demandTasks * cheapestParetoModel.costPerTaskVal
    : 0;
  const bestCostMonthly = bestQualityModel ? demandTasks * bestQualityModel.costPerTaskVal : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={<ShareButton label={t('copyLink')} copiedLabel={t('linkCopied')} />}
      />

      {/* Verdict Box */}
      {verdictResult && (
        <Card className="border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20">
          <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                💡 {t('verdict.title')}
              </span>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t(verdictResult.reasonKey, {
                  ...verdictResult.params,
                  low: verdictResult.savingsUsd ? fmt(verdictResult.savingsUsd.low) : '0',
                  high: verdictResult.savingsUsd ? fmt(verdictResult.savingsUsd.high) : '0',
                  savings: verdictResult.savingsUsd ? fmt(verdictResult.savingsUsd.low) : '0',
                })}
              </p>
            </div>
            <Link
              to="/advisor"
              className="inline-flex items-center justify-center text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition shrink-0"
            >
              {t('verdict.advisorLink')} →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Your Demand Bar */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-display">
              {t('yourDemand.title', {
                tasks: demandTasks.toLocaleString(),
                profileName: profile.name[lang] || profile.name.en,
              })}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              {cheapestParetoModel && bestQualityModel
                ? t('yourDemand.summary', {
                    apiCost: fmt(cheapestCostMonthly),
                    cheapestModel: cheapestParetoModel.model.name,
                    apiCostBest: fmt(bestCostMonthly),
                    bestModel: bestQualityModel.model.name,
                  })
                : t('yourDemand.noModels')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filter / Controls Bar */}
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <ProfileSelect />

            <NumberInput
              id="active-hours"
              label={t('filter.activeHours')}
              value={activeHours}
              onChange={handleActiveHoursChange}
              min={1}
              max={24}
              step={1}
            />

            <NumberInput
              id="max-price"
              label={t('filter.maxPrice', { currency })}
              value={maxPrice}
              onChange={(v) => setMaxPrice(v)}
              min={0}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
            {/* Provider Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300 mr-1">
                {t('filter.providers')}:
              </span>
              <button
                type="button"
                onClick={() => setProviders([])}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  providers.length === 0
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {t('filter.allProviders')}
              </button>
              {allProviders.map((p) => {
                const active = providers.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProvider(p)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <Toggle
                id="agent-only"
                label={t('filter.onlyAgent')}
                checked={agentOnly}
                onChange={setAgentOnly}
              />
              <Toggle
                id="published-only"
                label={t('filter.onlyPublished')}
                checked={publishedOnly}
                onChange={setPublishedOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards in Price Bands */}
      <div className="space-y-8">
        <div
          className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400"
          aria-live="polite"
        >
          <p>{t('selection.summary', { count: selectedPlanIds.length, max: 3 })}</p>
          <p className="text-xs">{t('selection.filterNote')}</p>
          {selectionFeedback && (
            <p role="status" className="font-medium text-amber-700 dark:text-amber-300">
              {selectionFeedback}
            </p>
          )}
        </div>

        {filteredPlans.length === 0 && (
          <Card className="border-dashed border-zinc-300 dark:border-zinc-700">
            <CardContent className="flex flex-col items-start gap-3 p-6">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {t('empty.title')}
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('empty.body')}</p>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {t('empty.resetFilters')}
              </button>
            </CardContent>
          </Card>
        )}
        {(['budget', 'about20', 'power', 'max'] as const).map((band) => {
          const bandPlans = priceBands[band];
          if (bandPlans.length === 0) return null;

          return (
            <div key={band} className="space-y-4">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-display border-b border-zinc-200 dark:border-zinc-800 pb-2">
                {t(`bands.${band}`)}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bandPlans.map((plan) => (
                  <SubscriptionCard
                    key={plan.id}
                    plan={plan}
                    profile={profile}
                    activeHoursPerDay={activeHours}
                    isSelectedForChart={selectedPlanIds.includes(plan.id)}
                    onToggleChartSelect={toggleChartSelect}
                    bestValueModel={cheapestParetoModel}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Break-even Chart */}
      <BreakEvenChart
        selectedPlans={effectiveSelectedPlans}
        profile={profile}
        activeHoursPerDay={activeHours}
        bestValueModel={cheapestParetoModel}
      />

      {/* Methodology Disclaimer */}
      <footer className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
        <p>{t('disclaimer')}</p>
      </footer>
    </div>
  );
}
