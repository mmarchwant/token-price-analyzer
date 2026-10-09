import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  NumberInput,
  PageHeader,
  Select,
  Stat,
  Tabs,
  Toggle,
} from '../../components/ui';
import { ProfileSelect } from '../../components/ProfileSelect';
import { ShareButton } from '../../components/ShareButton';
import { CopyNameButton } from '../../components/ui/CopyNameButton';
import { useAppData } from '../../data/AppData';
import { useActiveProfile, useMoney } from '../../data/hooks';
import { useSettingsStore } from '../../state/settings';
import { booleanCodec, enumCodec, numberCodec, useUrlState } from '../../state/urlState';
import { buildBudgetRows, pickHighlights, type BudgetRow } from './budgetRows';
import { filterModelsByIntent } from '../../domain/model-intent';
import { WorkTimeLadder } from './WorkTimeLadder';
import { BudgetBarChart } from './BudgetBarChart';
import type { Currency, QualityTier } from '../../domain/types';

export default function BudgetPage() {
  const { t } = useTranslation('budget');
  const { models, fees, subscriptions, status } = useAppData();
  const profile = useActiveProfile();
  const { fmt, fmtTokens, toUsd } = useMoney();

  const settingsBudget = useSettingsStore((state) => state.budget);
  const modelIntent = useSettingsStore((state) => state.modelIntent);
  const setSettingsBudget = useSettingsStore((state) => state.setBudget);
  const includeFreeModels = useSettingsStore((state) => state.includeFreeModels);
  const setIncludeFreeModels = useSettingsStore((state) => state.setIncludeFreeModels);
  const includeBatchOffers = useSettingsStore((state) => state.includeBatchOffers);
  const setIncludeBatchOffers = useSettingsStore((state) => state.setIncludeBatchOffers);

  // URL state
  const [amount, setAmount] = useUrlState('amount', numberCodec({ min: 0 }), settingsBudget.amount);
  const [cur, setCur] = useUrlState(
    'cur',
    enumCodec<Currency>(['USD', 'EUR', 'PLN']),
    settingsBudget.currency,
  );
  const [tier, setTier] = useUrlState(
    'tier',
    enumCodec<QualityTier>(['S', 'A', 'B', 'C', 'D']),
    'B',
  );
  const [metric, setMetric] = useUrlState(
    'metric',
    enumCodec<'days' | 'tasks' | 'tokens'>(['days', 'tasks', 'tokens']),
    'days',
  );
  const [feesToggle, setFeesToggle] = useUrlState('fees', booleanCodec, true);

  const [sortKey, setSortKey] = useState<keyof BudgetRow | 'modelName'>('workDays');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleAmountChange = (newVal: number) => {
    setAmount(newVal);
    setSettingsBudget({ amount: newVal, currency: cur });
  };

  const handleCurChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCur = e.target.value as Currency;
    setCur(newCur);
    setSettingsBudget({ amount, currency: newCur });
  };

  const budgetUsd = useMemo(() => toUsd(amount, cur), [amount, cur, toUsd]);

  const rows = useMemo(() => {
    if (status !== 'ready') return [];
    return buildBudgetRows({
      models: filterModelsByIntent(models, modelIntent),
      profile,
      budgetUsd,
      fees,
      includeFree: includeFreeModels,
      includeBatch: includeBatchOffers,
      applyFees: feesToggle,
    });
  }, [
    models,
    modelIntent,
    profile,
    budgetUsd,
    fees,
    includeFreeModels,
    includeBatchOffers,
    feesToggle,
    status,
  ]);

  const highlights = useMemo(() => pickHighlights(rows, tier), [rows, tier]);

  const matchingPlansCount = useMemo(() => {
    return subscriptions.filter((plan) => plan.priceUsdMonthly <= budgetUsd).length;
  }, [subscriptions, budgetUsd]);

  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let valA: number | string;
      let valB: number | string;

      if (sortKey === 'modelName') {
        valA = a.model.name;
        valB = b.model.name;
      } else if (sortKey === 'quality') {
        valA = a.quality ?? 0;
        valB = b.quality ?? 0;
      } else if (sortKey === 'tokens') {
        valA = a.tokens.inputTokens + a.tokens.outputTokens;
        valB = b.tokens.inputTokens + b.tokens.outputTokens;
      } else if (sortKey === 'generationHours') {
        valA = a.generationHours ?? 0;
        valB = b.generationHours ?? 0;
      } else {
        valA = (a[sortKey] as number) ?? 0;
        valB = (b[sortKey] as number) ?? 0;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    });
    return list;
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: keyof BudgetRow | 'modelName') => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const getSortDirection = (key: keyof BudgetRow | 'modelName') =>
    sortKey === key ? sortDir : undefined;

  const getAriaSortDirection = (key: keyof BudgetRow | 'modelName') => {
    const direction = getSortDirection(key);
    return direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined;
  };

  const getSortButtonLabel = (key: keyof BudgetRow | 'modelName', column: string) =>
    t('sort.buttonLabel', {
      column,
      direction: t(`sort.${getSortDirection(key) === 'asc' ? 'descending' : 'ascending'}`),
    });

  const getSortIndicator = (key: keyof BudgetRow | 'modelName') => {
    const direction = getSortDirection(key);
    if (!direction) return <span aria-hidden="true">↕</span>;

    return (
      <span aria-hidden="true" className="normal-case text-[10px] tracking-normal">
        {direction === 'asc' ? '↑' : '↓'}{' '}
        {t(direction === 'asc' ? 'sort.ascending' : 'sort.descending')}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={<ShareButton label={t('copyLink')} copiedLabel={t('linkCopied')} />}
      />

      {/* Controls Card */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <NumberInput
              label={t('budgetLabel')}
              value={amount}
              onChange={handleAmountChange}
              min={0}
              step={5}
            />
            <Select
              label={t('currencyLabel')}
              value={cur}
              onChange={handleCurChange}
              options={[
                { value: 'USD', label: 'USD ($)' },
                { value: 'EUR', label: 'EUR (€)' },
                { value: 'PLN', label: 'PLN (zł)' },
              ]}
            />
            <ProfileSelect label={t('profileLabel')} />
            <Select
              label={t('minTierLabel')}
              value={tier}
              onChange={(e) => setTier(e.target.value as QualityTier)}
              options={[
                { value: 'S', label: t('tier', { tier: 'S' }) },
                { value: 'A', label: t('tier', { tier: 'A' }) },
                { value: 'B', label: t('tier', { tier: 'B' }) },
                { value: 'C', label: t('tier', { tier: 'C' }) },
                { value: 'D', label: t('tier', { tier: 'D' }) },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Toggle
              label={t('includeFree')}
              checked={includeFreeModels}
              onChange={setIncludeFreeModels}
            />
            <Toggle
              label={t('includeBatch')}
              checked={includeBatchOffers}
              onChange={setIncludeBatchOffers}
            />
            <Toggle label={t('applyFees')} checked={feesToggle} onChange={setFeesToggle} />
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Tabs
              ariaLabel={t('metricLabel')}
              activeTab={metric}
              onChange={(id) => setMetric(id as 'days' | 'tasks' | 'tokens')}
              tabs={[
                { id: 'days', label: t('metrics.days') },
                { id: 'tasks', label: t('metrics.tasks') },
                { id: 'tokens', label: t('metrics.tokens') },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Best Quality Full Month */}
        <Stat
          label={t('highlights.bestQuality')}
          value={
            highlights.bestQualityFullMonth ? (
              <div className="flex items-center gap-2">
                <span className="truncate">{highlights.bestQualityFullMonth.model.name}</span>
                <CopyNameButton
                  text={highlights.bestQualityFullMonth.model.name}
                  ariaLabel={t('copyModelName', {
                    name: highlights.bestQualityFullMonth.model.name,
                  })}
                  copiedLabel={t('modelNameCopied')}
                />
                <Badge variant="accent">{highlights.bestQualityFullMonth.tier}</Badge>
              </div>
            ) : (
              <span className="text-zinc-400 text-sm font-normal">{t('highlights.noModel')}</span>
            )
          }
          hint={
            highlights.bestQualityFullMonth
              ? t('highlights.bestQualityDesc', {
                  days: highlights.bestQualityFullMonth.isFree
                    ? '∞'
                    : highlights.bestQualityFullMonth.workDays.toFixed(1),
                  tier: highlights.bestQualityFullMonth.tier,
                })
              : undefined
          }
        />

        {/* Card 2: Most Work Days */}
        <Stat
          label={t('highlights.cheapest')}
          value={
            highlights.cheapestAcceptable ? (
              <div className="flex items-center gap-2">
                <span className="truncate">{highlights.cheapestAcceptable.model.name}</span>
                <CopyNameButton
                  text={highlights.cheapestAcceptable.model.name}
                  ariaLabel={t('copyModelName', { name: highlights.cheapestAcceptable.model.name })}
                  copiedLabel={t('modelNameCopied')}
                />
                <Badge variant="accent">{highlights.cheapestAcceptable.tier}</Badge>
              </div>
            ) : (
              <span className="text-zinc-400 text-sm font-normal">{t('highlights.noModel')}</span>
            )
          }
          hint={
            highlights.cheapestAcceptable
              ? t('highlights.cheapestDesc', {
                  days: highlights.cheapestAcceptable.isFree
                    ? '∞'
                    : highlights.cheapestAcceptable.workDays.toFixed(1),
                  tier,
                })
              : undefined
          }
        />

        {/* Card 3: Best Value */}
        <Stat
          label={t('highlights.bestValue')}
          value={
            highlights.bestValue ? (
              <div className="flex items-center gap-2">
                <span className="truncate">{highlights.bestValue.model.name}</span>
                <CopyNameButton
                  text={highlights.bestValue.model.name}
                  ariaLabel={t('copyModelName', { name: highlights.bestValue.model.name })}
                  copiedLabel={t('modelNameCopied')}
                />
                <Badge variant="accent">{highlights.bestValue.tier}</Badge>
              </div>
            ) : (
              <span className="text-zinc-400 text-sm font-normal">{t('highlights.noModel')}</span>
            )
          }
          hint={
            highlights.bestValue
              ? t('highlights.bestValueDesc', {
                  coverage: Math.round(highlights.bestValue.coverageOfMonth * 100),
                  tier: highlights.bestValue.tier,
                })
              : undefined
          }
        />
      </div>

      {/* Work-time ladder */}
      <WorkTimeLadder rows={rows} minTier={tier} />

      {/* Bar Chart */}
      <BudgetBarChart rows={rows} profile={profile} metric={metric} minTier={tier} />

      {/* Mobile results prioritize the information needed to choose a model without table scrolling. */}
      <section className="lg:hidden" aria-labelledby="budget-results-heading">
        <div className="mb-3">
          <h2
            id="budget-results-heading"
            className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-display"
          >
            {t('tableTitle')}
          </h2>
        </div>
        <ol className="space-y-3">
          {sortedRows.map((r) => (
            <li key={`${r.model.id}-${r.offer.channel}`}>
              <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate font-bold text-zinc-900 dark:text-zinc-100">
                        {r.model.name}
                      </h3>
                      <CopyNameButton
                        text={r.model.name}
                        ariaLabel={t('copyModelName', { name: r.model.name })}
                        copiedLabel={t('modelNameCopied')}
                      />
                      <Badge variant="accent">{r.tier}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">{r.model.provider}</p>
                    {r.belowMinTopUp && (
                      <div className="pt-2">
                        <Badge variant="warning">
                          {t('belowMinTopUp', { min: r.fee ? fmt(r.fee.minTopUpUsd) : '$10' })}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 rounded-md bg-indigo-50 px-2 py-1 text-right text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
                    <span className="block text-[10px] font-medium">{t('col.workDays')}</span>
                    <span className="text-xs font-semibold tabular-nums">
                      {r.isFree ? t('freeInfinity') : t('daysShort', { d: r.workDays.toFixed(1) })}
                    </span>
                  </div>
                </header>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800">
                  <div>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t('col.channel')}</dt>
                    <dd className="mt-0.5 font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
                      {r.offer.channel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t('col.coverage')}</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {Math.round(r.coverageOfMonth * 100)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t('col.credit')}</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {fmt(r.credit)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t('col.tasks')}</dt>
                    <dd className="mt-0.5 tabular-nums text-zinc-900 dark:text-zinc-100">
                      {r.isFree ? t('freeInfinity') : fmtTokens(r.tasks)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t('col.tokens')}</dt>
                    <dd className="mt-0.5 tabular-nums text-zinc-900 dark:text-zinc-100">
                      {r.isFree
                        ? t('freeInfinity')
                        : `${fmtTokens(r.tokens.inputTokens)} / ${fmtTokens(r.tokens.outputTokens)}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t('col.genHours')}</dt>
                    <dd className="mt-0.5 tabular-nums text-zinc-900 dark:text-zinc-100">
                      {r.generationHours !== null
                        ? r.generationHours === Number.POSITIVE_INFINITY
                          ? '∞'
                          : t('hoursShort', { h: r.generationHours.toFixed(1) })
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 dark:text-zinc-400">{t('col.quality')}</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {r.quality !== undefined ? r.quality.toFixed(1) : '—'}
                    </dd>
                  </div>
                </dl>
              </article>
            </li>
          ))}
        </ol>
      </section>

      {/* Full table remains the efficient, sortable desktop presentation. */}
      <Card className="hidden lg:block">
        <CardHeader>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-display">
            {t('tableTitle')}
          </h2>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider select-none">
              <tr>
                <th className="px-4 py-3" aria-sort={getAriaSortDirection('modelName')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:text-zinc-100"
                    onClick={() => handleSort('modelName')}
                    aria-label={getSortButtonLabel('modelName', t('col.model'))}
                  >
                    {t('col.model')} {getSortIndicator('modelName')}
                  </button>
                </th>
                <th className="px-4 py-3">{t('col.channel')}</th>
                <th className="px-4 py-3" aria-sort={getAriaSortDirection('credit')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:text-zinc-100"
                    onClick={() => handleSort('credit')}
                    aria-label={getSortButtonLabel('credit', t('col.credit'))}
                  >
                    {t('col.credit')} {getSortIndicator('credit')}
                  </button>
                </th>
                <th className="px-4 py-3" aria-sort={getAriaSortDirection('tasks')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:text-zinc-100"
                    onClick={() => handleSort('tasks')}
                    aria-label={getSortButtonLabel('tasks', t('col.tasks'))}
                  >
                    {t('col.tasks')} {getSortIndicator('tasks')}
                  </button>
                </th>
                <th className="px-4 py-3" aria-sort={getAriaSortDirection('workDays')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:text-zinc-100"
                    onClick={() => handleSort('workDays')}
                    aria-label={getSortButtonLabel('workDays', t('col.workDays'))}
                  >
                    {t('col.workDays')} {getSortIndicator('workDays')}
                  </button>
                </th>
                <th className="px-4 py-3" aria-sort={getAriaSortDirection('coverageOfMonth')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:text-zinc-100"
                    onClick={() => handleSort('coverageOfMonth')}
                    aria-label={getSortButtonLabel('coverageOfMonth', t('col.coverage'))}
                  >
                    {t('col.coverage')} {getSortIndicator('coverageOfMonth')}
                  </button>
                </th>
                <th className="px-4 py-3" aria-sort={getAriaSortDirection('tokens')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:text-zinc-100"
                    onClick={() => handleSort('tokens')}
                    aria-label={getSortButtonLabel('tokens', t('col.tokens'))}
                  >
                    {t('col.tokens')} {getSortIndicator('tokens')}
                  </button>
                </th>
                <th className="px-4 py-3" aria-sort={getAriaSortDirection('generationHours')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:text-zinc-100"
                    onClick={() => handleSort('generationHours')}
                    aria-label={getSortButtonLabel('generationHours', t('col.genHours'))}
                  >
                    {t('col.genHours')} {getSortIndicator('generationHours')}
                  </button>
                </th>
                <th className="px-4 py-3" aria-sort={getAriaSortDirection('quality')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:text-zinc-100"
                    onClick={() => handleSort('quality')}
                    aria-label={getSortButtonLabel('quality', t('col.quality'))}
                  >
                    {t('col.quality')} {getSortIndicator('quality')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
              {sortedRows.map((r) => (
                <tr
                  key={`${r.model.id}-${r.offer.channel}`}
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">{r.model.name}</span>
                        <CopyNameButton
                          text={r.model.name}
                          ariaLabel={t('copyModelName', { name: r.model.name })}
                          copiedLabel={t('modelNameCopied')}
                        />
                        <Badge variant="accent">{r.tier}</Badge>
                      </div>
                      <span className="text-[10px] text-zinc-500">{r.model.provider}</span>
                      {r.belowMinTopUp && (
                        <div className="pt-0.5">
                          <Badge variant="warning">
                            {t('belowMinTopUp', {
                              min: r.fee ? fmt(r.fee.minTopUpUsd) : '$10',
                            })}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px]">{r.offer.channel}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{fmt(r.credit)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.isFree ? t('freeInfinity') : fmtTokens(r.tasks)}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {r.isFree ? t('freeInfinity') : t('daysShort', { d: r.workDays.toFixed(1) })}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{Math.round(r.coverageOfMonth * 100)}%</td>
                  <td className="px-4 py-3 tabular-nums text-[11px]">
                    {r.isFree
                      ? t('freeInfinity')
                      : `${fmtTokens(r.tokens.inputTokens)} / ${fmtTokens(r.tokens.outputTokens)}`}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.generationHours !== null
                      ? r.generationHours === Number.POSITIVE_INFINITY
                        ? '∞'
                        : t('hoursShort', { h: r.generationHours.toFixed(1) })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {r.quality !== undefined ? r.quality.toFixed(1) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Subscription Callout */}
      <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border-indigo-200 dark:border-indigo-800">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
            {t('subscriptionCallout', { count: matchingPlansCount })}
          </p>
          <Link to="/subscriptions" className="shrink-0">
            <Button variant="primary" size="sm">
              {t('subscriptionsCta')}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
