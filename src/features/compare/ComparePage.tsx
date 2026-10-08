import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PageHeader, Card, CardContent, CardHeader, Badge } from '../../components/ui';
import { ProfileSelect } from '../../components/ProfileSelect';
import { ShareButton } from '../../components/ShareButton';
import { useAppData } from '../../data/AppData';
import { useActiveProfile, useMoney } from '../../data/hooks';
import { useSettingsStore } from '../../state/settings';
import { listCodec, stringCodec, useUrlState } from '../../state/urlState';
import {
  buildCompareHref,
  buildCompareRows,
  parseItems,
  serializeItems,
  setStoredCompareRefs,
  type CompareRef,
} from './compareItems';
import { costPerTask, selectOffer, taskFromProfile } from '../../domain/pricing';
import { qualityScore } from '../../domain/quality';
import { capacityTasks, coverage } from '../../domain/subscriptions';

const ITEM_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

export default function ComparePage() {
  const { t, i18n } = useTranslation(['compare', 'common']);
  const lang = (i18n.language || 'en').startsWith('pl') ? 'pl' : 'en';

  const { models, subscriptions, fees, snapshot, fx } = useAppData();
  const profile = useActiveProfile();
  const { currency, isVatApplied } = useMoney();
  const settingsActiveHours = useSettingsStore((s) => s.activeHoursPerDay);

  const activeFx = useMemo(() => {
    return fx || { base: 'USD', rates: { USD: 1, EUR: 0.92, PLN: 4.2 } };
  }, [fx]);

  // URL state
  const [itemsParam, setItemsParam] = useUrlState('items', listCodec(stringCodec), []);
  const [, setProfileParam] = useUrlState('p', stringCodec, profile.id);

  const refs = useMemo(() => parseItems(itemsParam), [itemsParam]);

  // Sync to localStorage
  useEffect(() => {
    setStoredCompareRefs(refs);
  }, [refs]);

  const updateRefs = (newRefs: CompareRef[]) => {
    const tokens = serializeItems(newRefs);
    setItemsParam(tokens);
  };

  const handleRemove = (refToRemove: CompareRef) => {
    const next = refs.filter((r) => !(r.kind === refToRemove.kind && r.id === refToRemove.id));
    updateRefs(next);
  };

  const handleAdd = (refToAdd: CompareRef) => {
    const href = buildCompareHref(refs, refToAdd);
    const paramVal = new URLSearchParams(href.split('?')[1]).get('items') || '';
    const nextRefs = parseItems([paramVal]);
    updateRefs(nextRefs);
  };

  // Search / Combobox state
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Filter search candidates
  const candidates = useMemo(() => {
    if (!query.trim()) return { candidateModels: [], candidatePlans: [] };

    const q = query.toLowerCase().trim();

    const candidateModels = models
      .filter((m) => {
        const isAlreadyIn = refs.some((r) => r.kind === 'model' && r.id === m.id);
        if (isAlreadyIn) return false;
        return m.name.toLowerCase().includes(q) || m.providerName.toLowerCase().includes(q);
      })
      .slice(0, 5);

    const candidatePlans = subscriptions
      .filter((p) => {
        const isAlreadyIn = refs.some((r) => r.kind === 'plan' && r.id === p.id);
        if (isAlreadyIn) return false;
        return p.name.toLowerCase().includes(q) || p.providerName.toLowerCase().includes(q);
      })
      .slice(0, 5);

    return { candidateModels, candidatePlans };
  }, [models, subscriptions, refs, query]);

  const allCandidateOptions = useMemo(() => {
    const options: { ref: CompareRef; label: string; group: 'model' | 'plan' }[] = [];
    for (const m of candidates.candidateModels) {
      options.push({
        ref: { kind: 'model', id: m.id },
        label: `${m.name} (${m.providerName})`,
        group: 'model',
      });
    }
    for (const p of candidates.candidatePlans) {
      options.push({
        ref: { kind: 'plan', id: p.id },
        label: `${p.name} (${p.providerName})`,
        group: 'plan',
      });
    }
    return options;
  }, [candidates]);

  // Click outside listener for combobox
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % Math.max(1, allCandidateOptions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(
        (prev) => (prev - 1 + allCandidateOptions.length) % Math.max(1, allCandidateOptions.length),
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allCandidateOptions[highlightIndex]) {
        handleAdd(allCandidateOptions[highlightIndex].ref);
        setQuery('');
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Popular suggestions for empty state
  const popularSuggestions = useMemo(() => {
    // Top 2 models by quality
    const sortedModels = [...models].sort((a, b) => {
      const qA = qualityScore(a, profile.qualityDimension) ?? 0;
      const qB = qualityScore(b, profile.qualityDimension) ?? 0;
      return qB - qA;
    });
    const topModels = sortedModels.slice(0, 2);

    // Top 2 cheapest plans <= $25
    const cheapPlans = subscriptions
      .filter((p) => p.priceUsdMonthly <= 25)
      .sort((a, b) => a.priceUsdMonthly - b.priceUsdMonthly)
      .slice(0, 2);

    return { topModels, cheapPlans };
  }, [models, subscriptions, profile]);

  // Table rows
  const tableRows = useMemo(() => {
    return buildCompareRows(
      refs,
      { models, subscriptions, fees },
      profile,
      {
        currency,
        fx: activeFx,
        isVatApplied,
        activeHoursPerDay: settingsActiveHours,
        snapshotDate: snapshot?.generatedAt ? snapshot.generatedAt.split('T')[0] : undefined,
      },
      lang,
    );
  }, [
    refs,
    models,
    subscriptions,
    fees,
    profile,
    currency,
    activeFx,
    isVatApplied,
    settingsActiveHours,
    snapshot,
    lang,
  ]);

  // Chart normalized data
  const chartData = useMemo(() => {
    if (refs.length === 0) return [];

    const task = taskFromProfile(profile);
    const workDays = profile.workDaysPerMonth || 20;
    const demandTasks = profile.tasksPerDay * workDays;

    // Collect raw metrics
    const itemMetrics = refs.map((ref) => {
      const itemKey = `${ref.kind}:${ref.id}`;

      if (ref.kind === 'model') {
        const model = models.find((m) => m.id === ref.id);
        if (!model)
          return { itemKey, name: ref.id, qScore: 0, coveragePct: 0, valRatio: 0, speedVal: 0 };

        const offer = selectOffer(model, task, { includeFree: true, includeBatch: false });
        const cTask = offer ? costPerTask(task, offer) : 0;
        const qVal =
          (qualityScore(model, profile.qualityDimension) ?? model.quality.intelligence) || 0;
        const valRatio = cTask > 0 ? qVal / cTask : qVal * 10;
        const speedVal = model.speed?.outputTokensPerSecond ?? 0;

        return {
          itemKey,
          name: model.name,
          qScore: qVal,
          coveragePct: 100,
          valRatio,
          speedVal,
        };
      } else {
        const plan = subscriptions.find((p) => p.id === ref.id);
        if (!plan)
          return { itemKey, name: ref.id, qScore: 0, coveragePct: 0, valRatio: 0, speedVal: 0 };

        const primaryModel = models.find((m) => m.id === plan.primaryModelId);
        const primaryOffer = primaryModel
          ? selectOffer(primaryModel, task, { includeFree: false, includeBatch: false })
          : undefined;

        const cap = capacityTasks(plan, profile, primaryOffer, {
          activeHoursPerDay: settingsActiveHours,
          workDaysPerMonth: workDays,
        });
        const cov = coverage(cap, demandTasks);
        const covPct = cov ? Math.round(cov.low * 100) : 0;

        const primaryQ = primaryModel
          ? (qualityScore(primaryModel, profile.qualityDimension) ??
              primaryModel.quality.intelligence) ||
            50
          : 50;

        const avgCap = cap ? (cap.low + cap.high) / 2 : 1;
        const avgCostPerTask = avgCap > 0 ? plan.priceUsdMonthly / avgCap : 1;
        const valRatio = avgCostPerTask > 0 ? primaryQ / avgCostPerTask : primaryQ;
        const speedVal = primaryModel?.speed?.outputTokensPerSecond ?? 0;

        return {
          itemKey,
          name: plan.name,
          qScore: primaryQ,
          coveragePct: covPct,
          valRatio,
          speedVal,
        };
      }
    });

    // Find max value and max speed for normalization
    const maxValRatio = Math.max(...itemMetrics.map((i) => i.valRatio), 1);
    const maxSpeed = Math.max(...itemMetrics.map((i) => i.speedVal), 1);

    // Metrics categories
    const metricCategories = [
      { metricKey: 'quality', label: t('metrics.quality') },
      { metricKey: 'coverage', label: t('metrics.coverage') },
      { metricKey: 'value', label: t('metrics.value') },
      { metricKey: 'speed', label: t('metrics.speed') },
    ];

    return metricCategories.map((cat) => {
      const entry: Record<string, unknown> = { category: cat.label };

      itemMetrics.forEach((item) => {
        let normVal = 0;
        if (cat.metricKey === 'quality') normVal = Math.round(item.qScore);
        else if (cat.metricKey === 'coverage') normVal = item.coveragePct;
        else if (cat.metricKey === 'value')
          normVal = Math.min(100, Math.round((item.valRatio / maxValRatio) * 100));
        else if (cat.metricKey === 'speed')
          normVal = maxSpeed > 0 ? Math.min(100, Math.round((item.speedVal / maxSpeed) * 100)) : 0;

        entry[item.itemKey] = normVal;
      });

      return entry;
    });
  }, [refs, models, subscriptions, profile, settingsActiveHours, t]);

  const hasMissingSpeed = useMemo(() => {
    return refs.some((ref) => {
      if (ref.kind === 'model') {
        const m = models.find((item) => item.id === ref.id);
        return !m?.speed?.outputTokensPerSecond;
      }
      return true;
    });
  }, [refs, models]);

  const comparisonItems = useMemo(
    () =>
      refs.map((ref) => {
        const itemKey = `${ref.kind}:${ref.id}`;
        const item =
          ref.kind === 'model'
            ? models.find((model) => model.id === ref.id)
            : subscriptions.find((plan) => plan.id === ref.id);

        return {
          ref,
          itemKey,
          name: item?.name ?? ref.id,
          provider: item?.providerName ?? '',
        };
      }),
    [refs, models, subscriptions],
  );

  return (
    <div className="space-y-8 pb-12">
      <PageHeader title={t('title')} subtitle={t('subtitle')} actions={<ShareButton />} />

      {/* Top Profile Selector & Search Picker */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <ProfileSelect onChange={(profileId) => setProfileParam(profileId)} />

            {/* Accessible Combobox Picker */}
            <div ref={comboboxRef} className="relative space-y-1.5">
              <label
                htmlFor="compare-picker"
                className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                {t('pickerLabel')}
              </label>
              <div className="relative">
                <input
                  id="compare-picker"
                  type="text"
                  role="combobox"
                  aria-expanded={isOpen}
                  aria-haspopup="listbox"
                  aria-autocomplete="list"
                  aria-controls="compare-picker-listbox"
                  value={query}
                  disabled={refs.length >= 4}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                    setHighlightIndex(0);
                  }}
                  onFocus={() => setIsOpen(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={refs.length >= 4 ? t('maxItemsNotice') : t('pickerPlaceholder')}
                  className="w-full px-3.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>

              {/* Dropdown Listbox */}
              {isOpen && allCandidateOptions.length > 0 && (
                <ul
                  id="compare-picker-listbox"
                  role="listbox"
                  className="absolute left-0 right-0 top-full mt-1 z-50 max-h-60 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg text-xs divide-y divide-zinc-100 dark:divide-zinc-800"
                >
                  {allCandidateOptions.map((opt, idx) => {
                    const isHighlighted = idx === highlightIndex;
                    return (
                      <li
                        key={`${opt.ref.kind}:${opt.ref.id}`}
                        role="option"
                        aria-selected={isHighlighted}
                        onClick={() => {
                          handleAdd(opt.ref);
                          setQuery('');
                          setIsOpen(false);
                        }}
                        onMouseEnter={() => setHighlightIndex(idx)}
                        className={`px-3 py-2 cursor-pointer flex items-center justify-between ${
                          isHighlighted
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-semibold'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <Badge variant={opt.group === 'model' ? 'info' : 'accent'}>
                          {opt.group === 'model' ? t('groups.models') : t('groups.plans')}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Selected Chips */}
          {refs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              {refs.map((ref) => {
                const itemKey = `${ref.kind}:${ref.id}`;
                if (ref.kind === 'model') {
                  const m = models.find((item) => item.id === ref.id);
                  if (!m) {
                    return (
                      <span
                        key={itemKey}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 border border-zinc-200 dark:border-zinc-700"
                      >
                        <span>{t('notFound', { id: ref.id })}</span>
                        <button
                          type="button"
                          onClick={() => handleRemove(ref)}
                          className="hover:text-zinc-800 dark:hover:text-zinc-200 font-bold"
                          aria-label={t('removeItem', { name: ref.id })}
                        >
                          ×
                        </button>
                      </span>
                    );
                  }
                  return (
                    <span
                      key={itemKey}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800"
                    >
                      <span>
                        🤖 {m.name} ({m.providerName})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemove(ref)}
                        className="hover:text-indigo-600 dark:hover:text-indigo-300 font-bold ml-1"
                        aria-label={t('removeItem', { name: m.name })}
                      >
                        ×
                      </button>
                    </span>
                  );
                } else {
                  const p = subscriptions.find((item) => item.id === ref.id);
                  if (!p) {
                    return (
                      <span
                        key={itemKey}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 border border-zinc-200 dark:border-zinc-700"
                      >
                        <span>{t('notFound', { id: ref.id })}</span>
                        <button
                          type="button"
                          onClick={() => handleRemove(ref)}
                          className="hover:text-zinc-800 dark:hover:text-zinc-200 font-bold"
                          aria-label={t('removeItem', { name: ref.id })}
                        >
                          ×
                        </button>
                      </span>
                    );
                  }
                  return (
                    <span
                      key={itemKey}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                    >
                      <span>
                        💳 {p.name} ({p.providerName})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemove(ref)}
                        className="hover:text-emerald-600 dark:hover:text-emerald-300 font-bold ml-1"
                        aria-label={t('removeItem', { name: p.name })}
                      >
                        ×
                      </button>
                    </span>
                  );
                }
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty State with Popular Suggestions */}
      {refs.length === 0 ? (
        <Card className="border-dashed border-zinc-300 dark:border-zinc-800">
          <CardContent className="p-8 text-center space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-display">
                {t('emptyTitle')}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
                {t('emptySubtitle')}
              </p>
            </div>

            <div className="space-y-3 pt-2 max-w-xl mx-auto text-left">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {t('popularTitle')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {popularSuggestions.topModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleAdd({ kind: 'model', id: m.id })}
                    className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left text-xs"
                  >
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">{m.name}</div>
                      <div className="text-[11px] text-zinc-500">{m.providerName}</div>
                    </div>
                    <Badge variant="info">{t('qualityBadge')}</Badge>
                  </button>
                ))}

                {popularSuggestions.cheapPlans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAdd({ kind: 'plan', id: p.id })}
                    className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left text-xs"
                  >
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">{p.name}</div>
                      <div className="text-[11px] text-zinc-500">
                        {p.providerName} (${p.priceUsdMonthly}
                        {t('perMonth')})
                      </div>
                    </div>
                    <Badge variant="accent">{t('groups.plans')}</Badge>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Comparison Table */}
          <Card>
            <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-display">
                {t('tableTitle')}
              </h2>
            </CardHeader>
            <CardContent className="p-0">
              <section
                className="divide-y divide-zinc-200 dark:divide-zinc-800 lg:hidden"
                aria-label={t('mobileComparisonTitle')}
              >
                {comparisonItems.map(({ ref, itemKey, name, provider }) => (
                  <article key={itemKey} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Badge variant={ref.kind === 'plan' ? 'accent' : 'info'} className="mb-1">
                          {ref.kind === 'plan' ? t('groups.plans') : t('groups.models')}
                        </Badge>
                        <h3 className="break-words text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {name}
                        </h3>
                        {provider && (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{provider}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(ref)}
                        className="shrink-0 p-1 font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        aria-label={t('removeItem', { name })}
                      >
                        ×
                      </button>
                    </div>
                    <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-x-3 gap-y-2 text-xs">
                      {tableRows.map((row) => {
                        const cell = row.cells[itemKey];
                        const valueClass = cell?.isBest
                          ? 'font-semibold text-emerald-700 dark:text-emerald-300'
                          : cell?.isWorst
                            ? 'text-rose-700 dark:text-rose-300'
                            : 'text-zinc-900 dark:text-zinc-100';

                        return (
                          <React.Fragment key={row.key}>
                            <dt className="text-zinc-500 dark:text-zinc-400">
                              {t(`rows.${row.key}` as keyof typeof t)}
                            </dt>
                            <dd className={`break-words text-right ${valueClass}`}>
                              {cell?.value ?? '—'}
                            </dd>
                          </React.Fragment>
                        );
                      })}
                    </dl>
                  </article>
                ))}
              </section>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800">
                      <th className="sticky left-0 bg-zinc-50 dark:bg-zinc-800/60 z-20 px-4 py-3 font-bold text-zinc-700 dark:text-zinc-300 min-w-[160px] border-r border-zinc-200 dark:border-zinc-800">
                        {t('featureMetric')}
                      </th>
                      {comparisonItems.map(({ ref, itemKey, name, provider }) => {
                        const isPlan = ref.kind === 'plan';
                        return (
                          <th
                            key={itemKey}
                            className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 min-w-[200px]"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <Badge variant={isPlan ? 'accent' : 'info'} className="mb-1">
                                  {isPlan ? t('groups.plans') : t('groups.models')}
                                </Badge>
                                <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                  {name}
                                </div>
                                {provider && (
                                  <div className="text-[11px] font-normal text-zinc-500">
                                    {provider}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemove(ref)}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold p-1"
                                aria-label={t('removeItem', { name })}
                              >
                                ×
                              </button>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {tableRows.map((row) => (
                      <tr
                        key={row.key}
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                      >
                        <td className="sticky left-0 bg-white dark:bg-zinc-900 z-10 px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-800">
                          {t(`rows.${row.key}` as keyof typeof t)}
                        </td>
                        {comparisonItems.map(({ itemKey }) => {
                          const cell = row.cells[itemKey];
                          if (!cell)
                            return (
                              <td key={itemKey} className="px-4 py-3 text-zinc-400">
                                —
                              </td>
                            );

                          let cellClasses = 'px-4 py-3 transition-colors ';
                          if (cell.isBest) {
                            cellClasses +=
                              'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 font-semibold border-l-2 border-emerald-500';
                          } else if (cell.isWorst) {
                            cellClasses +=
                              'bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200 border-l-2 border-rose-500';
                          } else {
                            cellClasses += 'text-zinc-700 dark:text-zinc-300';
                          }

                          return (
                            <td key={itemKey} className={cellClasses}>
                              {cell.value}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Recharts Grouped Bar Chart */}
          <Card>
            <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-display">
                {t('chartTitle')}
              </h2>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <XAxis dataKey="category" stroke="#888888" fontSize={12} />
                    <YAxis domain={[0, 100]} stroke="#888888" fontSize={12} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        return (
                          <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-md text-xs space-y-1">
                            <p className="font-bold text-zinc-900 dark:text-zinc-100">{label}</p>
                            {payload.map((entry) => {
                              const itemKey = entry.dataKey as string;
                              const refParts = itemKey.split(':');
                              let name = refParts[1] || itemKey;
                              if (refParts[0] === 'model') {
                                const m = models.find((i) => i.id === refParts[1]);
                                if (m) name = m.name;
                              } else {
                                const p = subscriptions.find((i) => i.id === refParts[1]);
                                if (p) name = p.name;
                              }

                              return (
                                <p
                                  key={itemKey}
                                  style={{ color: entry.color }}
                                  className="font-medium"
                                >
                                  {name}: {entry.value} {t('outOf100')}
                                </p>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      formatter={(value: unknown) => {
                        const valStr = String(value);
                        const refParts = valStr.split(':');
                        if (refParts[0] === 'model') {
                          const m = models.find((item) => item.id === refParts[1]);
                          return m ? m.name : valStr;
                        } else {
                          const p = subscriptions.find((item) => item.id === refParts[1]);
                          return p ? p.name : valStr;
                        }
                      }}
                    />
                    {refs.map((ref, idx) => {
                      const itemKey = `${ref.kind}:${ref.id}`;
                      return (
                        <Bar
                          key={itemKey}
                          dataKey={itemKey}
                          fill={ITEM_COLORS[idx % ITEM_COLORS.length]}
                          radius={[4, 4, 0, 0]}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {hasMissingSpeed && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  ℹ️ {t('speedNote')}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
