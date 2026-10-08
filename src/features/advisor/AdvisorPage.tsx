import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Toggle } from '../../components/ui/Toggle';
import { Tooltip } from '../../components/ui/Tooltip';
import { NumberInput } from '../../components/ui/NumberInput';
import { EmptyState } from '../../components/ui/EmptyState';
import { ShareButton } from '../../components/ShareButton';
import { useAppData } from '../../data/AppData';
import { useMoney } from '../../data/hooks';
import { useSettingsStore } from '../../state/settings';
import {
  booleanCodec,
  enumCodec,
  listCodec,
  numberCodec,
  stringCodec,
  useUrlState,
} from '../../state/urlState';
import { advise } from '../../domain/advisor/engine';
import {
  buildCompareHref,
  getStoredCompareRefs,
  parseItems,
  serializeItems,
} from '../compare/compareItems';
import type { AdvisorInput, Needs, Recommendation } from '../../domain/advisor/types';
import type {
  Currency,
  ModelEntry,
  QualityTier,
  SubscriptionPlan,
  UsageProfile,
} from '../../domain/types';

const NEED_KEYS: (keyof Needs)[] = [
  'codingAgent',
  'imageGeneration',
  'deepResearch',
  'longContext',
  'openWeights',
  'toolCalling',
];

const TIER_OPTIONS: (QualityTier | 'any')[] = ['any', 'D', 'C', 'B', 'A', 'S'];

function PresetIcon({ id }: { id: string }) {
  if (id.includes('coding') || id.includes('dev')) {
    return (
      <svg
        className="w-5 h-5 text-indigo-500 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    );
  }
  if (id.includes('agent') || id.includes('auto')) {
    return (
      <svg
        className="w-5 h-5 text-emerald-500 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    );
  }
  if (id.includes('light') || id.includes('writing')) {
    return (
      <svg
        className="w-5 h-5 text-amber-500 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    );
  }
  return (
    <svg
      className="w-5 h-5 text-sky-500 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  );
}

export default function AdvisorPage() {
  const { t, i18n } = useTranslation('advisor');
  const lang = (i18n.language || 'en').startsWith('pl') ? 'pl' : 'en';
  const { models, subscriptions, profiles, fees } = useAppData();

  const settingsBudget = useSettingsStore((s) => s.budget);
  const settingsActiveHours = useSettingsStore((s) => s.activeHoursPerDay);
  const setSettingsBudget = useSettingsStore((s) => s.setBudget);

  // URL synced state
  const [budgetUsdState, setBudgetUsd] = useUrlState('b', numberCodec({ min: 0 }), -1);
  const budgetUsd = budgetUsdState === -1 ? settingsBudget.amount : budgetUsdState;

  const [currency, setCurrency] = useUrlState(
    'cur',
    enumCodec<Currency>(['USD', 'PLN', 'EUR']),
    settingsBudget.currency,
  );
  const [profileId, setProfileId] = useUrlState('p', stringCodec, 'chat-heavy');
  const [intensity, setIntensity] = useUrlState('i', numberCodec({ min: 0.25, max: 4 }), 1.0);
  const [activeHours, setActiveHours] = useUrlState(
    'h',
    numberCodec({ min: 1, max: 24 }),
    settingsActiveHours,
  );
  const [activeNeedsList, setActiveNeedsList] = useUrlState('needs', listCodec(stringCodec), []);
  const [minTier, setMinTier] = useUrlState(
    'tier',
    enumCodec<QualityTier | 'any'>(TIER_OPTIONS),
    'any',
  );
  const [includeFree, setIncludeFree] = useUrlState('free', booleanCodec, true);
  const [preferFlexibility, setPreferFlexibility] = useUrlState('flex', booleanCodec, false);

  // Convert active needs list to Needs object
  const needsObj: Needs = useMemo(() => {
    return {
      codingAgent: activeNeedsList.includes('codingAgent'),
      imageGeneration: activeNeedsList.includes('imageGeneration'),
      deepResearch: activeNeedsList.includes('deepResearch'),
      longContext: activeNeedsList.includes('longContext'),
      openWeights: activeNeedsList.includes('openWeights'),
      toolCalling: activeNeedsList.includes('toolCalling'),
    };
  }, [activeNeedsList]);

  const activeProfile = useMemo(() => {
    return (
      profiles.find((p: UsageProfile) => p.id === profileId) ||
      profiles[0] || {
        id: 'custom',
        name: { en: 'Custom Profile', pl: 'Profil własny' },
        description: { en: '', pl: '' },
        inputTokensPerTask: 2000,
        outputTokensPerTask: 500,
        cachedInputShare: 0,
        tasksPerDay: 50,
        workDaysPerMonth: 22,
        qualityDimension: 'intelligence',
        allowBatch: false,
        isPreset: false,
      }
    );
  }, [profiles, profileId]);

  // Sync budget updates to Zustand settings
  const handleBudgetChange = (amount: number) => {
    setBudgetUsd(amount);
    setSettingsBudget({ amount, currency });
  };

  const handleCurrencyChange = (newCur: Currency) => {
    setCurrency(newCur);
    setSettingsBudget({ amount: budgetUsd, currency: newCur });
  };

  const toggleNeed = (needKey: keyof Needs) => {
    if (activeNeedsList.includes(needKey)) {
      setActiveNeedsList(activeNeedsList.filter((k) => k !== needKey));
    } else {
      setActiveNeedsList([...activeNeedsList, needKey]);
    }
  };

  // Debounce advisor computation (200ms)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const input: AdvisorInput = {
        budgetUsd,
        profile: activeProfile as UsageProfile,
        intensity,
        activeHoursPerDay: activeHours,
        needs: needsObj,
        minTier,
        includeFree,
        preferFlexibility,
      };
      const recs = advise(input, { models, subscriptions, channelFees: fees });
      setRecommendations(recs);
    }, 200);

    return () => clearTimeout(timer);
  }, [
    budgetUsd,
    activeProfile,
    intensity,
    activeHours,
    needsObj,
    minTier,
    includeFree,
    preferFlexibility,
    models,
    subscriptions,
    fees,
  ]);

  const demandTasks = Math.round(
    (activeProfile.tasksPerDay || 50) * intensity * (activeProfile.workDaysPerMonth || 22),
  );

  return (
    <div className="space-y-8 pb-12">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* 5-Step Interactive Wizard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Step 1: Budget */}
        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t('steps.budget.title')}
          </h3>
          <div className="space-y-2">
            <label
              htmlFor="advisor-budget"
              className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              {t('steps.budget.label')}
            </label>
            <div className="flex gap-2">
              <NumberInput
                id="advisor-budget"
                value={budgetUsd}
                onChange={handleBudgetChange}
                min={0}
                className="w-full"
              />
              <Select
                aria-label={t('steps.budget.currencyLabel')}
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
                options={[
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'PLN', label: 'PLN (zł)' },
                  { value: 'EUR', label: 'EUR (€)' },
                ]}
                className="w-24 shrink-0"
              />
            </div>
          </div>
        </Card>

        {/* Step 2: What do you do? */}
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('steps.profile.title')}
            </h3>
            <Link
              to="/profiles"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('steps.profile.custom')}
            </Link>
          </div>
          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-48 pr-1">
            {profiles.map((p: UsageProfile) => {
              const isSelected = p.id === activeProfile.id;
              const pName = p.name[lang] || p.name.en;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProfileId(p.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-200'
                      : 'bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <PresetIcon id={p.id} />
                  <span className="truncate">{pName}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Step 3: How much? */}
        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t('steps.intensity.title')}
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {intensity}x intensity
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {t('steps.intensity.tasksPerMonth', { count: demandTasks })}
                </span>
              </div>
              <input
                type="range"
                aria-label={t('steps.intensity.intensityLabel', { value: intensity })}
                min={0.25}
                max={4.0}
                step={0.25}
                value={intensity}
                onChange={(e) => setIntensity(Number.parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
            <div>
              <label
                htmlFor="advisor-hours"
                className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1"
              >
                {t('steps.intensity.hoursLabel')}: {activeHours}h
              </label>
              <input
                id="advisor-hours"
                type="range"
                min={1}
                max={24}
                step={1}
                value={activeHours}
                onChange={(e) => setActiveHours(Number.parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>
        </Card>

        {/* Step 4: Must-haves */}
        <Card className="flex flex-col gap-3 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t('steps.needs.title')}
          </h3>
          <div className="grid grid-cols-1 gap-1.5">
            {NEED_KEYS.map((needKey) => {
              const checked = needsObj[needKey];
              const label = t(`steps.needs.${needKey}`);
              const tooltipText = t(`steps.needs.${needKey}Tooltip`);

              return (
                <Tooltip key={needKey} content={tooltipText} position="top">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300 select-none">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleNeed(needKey)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <span>{label}</span>
                  </label>
                </Tooltip>
              );
            })}
          </div>
        </Card>

        {/* Step 5: Minimum Quality & Options */}
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('steps.quality.title')}
            </h3>
            <Tooltip content={t('steps.quality.tierTooltip')}>
              <span className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-help text-xs">
                ⓘ
              </span>
            </Tooltip>
          </div>
          <div className="space-y-3">
            <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700">
              {TIER_OPTIONS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setMinTier(tier)}
                  className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                    minTier === tier
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {tier === 'any' ? t('steps.quality.anyTier') : tier}
                </button>
              ))}
            </div>
            <div className="space-y-2 pt-1">
              <Toggle
                checked={includeFree}
                onChange={setIncludeFree}
                label={t('steps.quality.includeFree')}
              />
              <Toggle
                checked={preferFlexibility}
                onChange={setPreferFlexibility}
                label={t('steps.quality.preferFlexibility')}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Share / Results header actions */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {recommendations.length > 0 ? t('results.topPickBadge') : ''}
        </h2>
        <ShareButton label={t('results.copyLink')} copiedLabel={t('results.linkCopied')} />
      </div>

      {/* Recommendations Output */}
      {recommendations.length === 0 ? (
        <EmptyState
          title={t('results.emptyState.title')}
          description={t('results.emptyState.subtitle')}
        />
      ) : (
        <div className="space-y-6">
          {/* Top Pick Recommendation Card */}
          {recommendations[0] && (
            <RecommendationCard
              rec={recommendations[0]}
              isTopPick
              models={models}
              subscriptions={subscriptions}
            />
          )}

          {/* Remaining Recommendations List */}
          {recommendations.length > 1 && (
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {t('results.otherPickBadge')}s
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendations.slice(1).map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    isTopPick={false}
                    models={models}
                    subscriptions={subscriptions}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Disclaimer */}
      <div className="pt-8 text-center text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800">
        <p>{t('results.footerDisclaimer')}</p>
      </div>
    </div>
  );
}

function RecommendationCard({
  rec,
  isTopPick,
  models,
  subscriptions,
}: {
  rec: Recommendation;
  isTopPick: boolean;
  models: ModelEntry[];
  subscriptions: SubscriptionPlan[];
}) {
  const { t } = useTranslation('advisor');
  const { fmt } = useMoney();

  const strategyLabel = t(`strategies.${rec.strategy}` as keyof typeof t);

  // Build item names and links
  const itemElements: React.ReactNode[] = [];

  let compareRefs = getStoredCompareRefs();

  for (const pId of rec.planIds) {
    const plan = subscriptions.find((p) => p.id === pId);
    if (plan) {
      itemElements.push(
        <Link
          key={`p-${pId}`}
          to={`/subscriptions`}
          className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
        >
          {plan.name} ({plan.providerName})
        </Link>,
      );
      const nextHref = buildCompareHref(compareRefs, { kind: 'plan', id: pId });
      const itemsParam = new URLSearchParams(nextHref.split('?')[1]).get('items') || '';
      compareRefs = parseItems([itemsParam]);
    }
  }

  for (const mId of rec.modelIds) {
    const model = models.find((m) => m.id === mId);
    if (model) {
      itemElements.push(
        <Link
          key={`m-${mId}`}
          to={`/explorer?search=${encodeURIComponent(model.name)}`}
          className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
        >
          {model.name} ({model.providerName})
        </Link>,
      );
      const nextHref = buildCompareHref(compareRefs, { kind: 'model', id: mId });
      const itemsParam = new URLSearchParams(nextHref.split('?')[1]).get('items') || '';
      compareRefs = parseItems([itemsParam]);
    }
  }

  const compareUrl = `/compare?items=${encodeURIComponent(serializeItems(compareRefs).join(','))}`;

  const covLowPct = rec.coverage ? Math.round(rec.coverage.low * 100) : null;
  const covHighPct = rec.coverage ? Math.round(rec.coverage.high * 100) : null;

  return (
    <Card
      className={`relative overflow-hidden transition-all ${
        isTopPick
          ? 'p-6 border-2 border-indigo-500 dark:border-indigo-500 bg-linear-to-br from-indigo-50/30 to-white dark:from-indigo-950/20 dark:to-zinc-900 shadow-md'
          : 'p-5 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {isTopPick && (
            <Badge variant="accent" className="font-bold">
              {t('results.topPickBadge')}
            </Badge>
          )}
          <Badge variant="info">{strategyLabel}</Badge>
          {rec.tier && <Badge variant="neutral">Tier {rec.tier}</Badge>}
        </div>
        <div className="text-right">
          <span className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
            {fmt(rec.monthlyCostUsd)}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 block">
            {t('results.monthlyCost')}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-base font-medium text-zinc-900 dark:text-zinc-100 flex flex-wrap gap-2 items-center">
          {itemElements.reduce((prev: React.ReactNode[], curr: React.ReactNode, idx: number) => {
            if (prev.length === 0) return [curr];
            return [...prev, <span key={`sep-${idx}`}>+</span>, curr];
          }, [])}
        </div>
      </div>

      {/* Coverage Band Bar */}
      <div className="space-y-1 mb-4">
        <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 font-medium">
          <span>{t('results.coverage')}</span>
          <span>
            {covLowPct !== null
              ? covLowPct === covHighPct
                ? `${covLowPct}%`
                : `${covLowPct}%–${covHighPct}%`
              : t('reasons.limits-unpublished')}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
            style={{ width: `${covLowPct ?? 60}%` }}
          />
        </div>
      </div>

      {/* Reasons & Warnings */}
      <div className="space-y-1.5 mb-4 text-xs">
        {rec.reasons.map((r, idx) => (
          <div key={idx} className="flex items-start gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span className="text-emerald-500 font-bold">✓</span>
            <span>
              {t(
                `reasons.${r.code}` as keyof typeof t,
                r.params as Record<string, string | number>,
              )}
            </span>
          </div>
        ))}

        {rec.warnings.map((w, idx) => (
          <div key={idx} className="inline-flex items-center gap-1 mt-1 mr-2">
            <Badge variant="warning">
              {t(
                `reasons.${w.code}` as keyof typeof t,
                w.params as Record<string, string | number>,
              )}
            </Badge>
          </div>
        ))}
      </div>

      {/* Score and Links */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          {t('results.score')}:{' '}
          <span className="text-indigo-600 dark:text-indigo-400 font-bold">{rec.score}</span> / 100
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          {rec.planIds.length > 0 && (
            <Link
              to="/subscriptions"
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('results.seeInSubscriptions')}
            </Link>
          )}
          {rec.modelIds.length > 0 && (
            <Link to="/explorer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              {t('results.seeInExplorer')}
            </Link>
          )}
          <Link
            to={compareUrl}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
          >
            {t('results.compare')}
          </Link>
        </div>
      </div>
    </Card>
  );
}
