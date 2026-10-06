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
import { useAppData } from '../../data/AppData';
import { useActiveProfile, useMoney } from '../../data/hooks';
import { useSettingsStore } from '../../state/settings';
import {
  booleanCodec,
  buildShareUrl,
  enumCodec,
  numberCodec,
  useUrlState,
} from '../../state/urlState';
import { buildBudgetRows, pickHighlights, type BudgetRow } from './budgetRows';
import { WorkTimeLadder } from './WorkTimeLadder';
import { BudgetBarChart } from './BudgetBarChart';
import type { Currency, QualityTier } from '../../domain/types';

export default function BudgetPage() {
  const { t } = useTranslation('budget');
  const { models, fees, subscriptions, status } = useAppData();
  const profile = useActiveProfile();
  const { fmt, fmtTokens, toUsd } = useMoney();

  const settingsBudget = useSettingsStore((state) => state.budget);
  const setSettingsBudget = useSettingsStore((state) => state.setBudget);
  const includeFreeModels = useSettingsStore((state) => state.includeFreeModels);
  const setIncludeFreeModels = useSettingsStore((state) => state.setIncludeFreeModels);
  const includeBatchOffers = useSettingsStore((state) => state.includeBatchOffers);
  const setIncludeBatchOffers = useSettingsStore((state) => state.setIncludeBatchOffers);
  const activeHoursPerDay = useSettingsStore((state) => state.activeHoursPerDay);

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

  const [copied, setCopied] = useState(false);
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

  const handleCopyLink = () => {
    const url = buildShareUrl();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const budgetUsd = useMemo(() => toUsd(amount, cur), [amount, cur, toUsd]);

  const rows = useMemo(() => {
    if (status !== 'ready') return [];
    return buildBudgetRows({
      models,
      profile,
      budgetUsd,
      fees,
      includeFree: includeFreeModels,
      includeBatch: includeBatchOffers,
      applyFees: feesToggle,
    });
  }, [models, profile, budgetUsd, fees, includeFreeModels, includeBatchOffers, feesToggle, status]);

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

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button variant="secondary" size="sm" onClick={handleCopyLink}>
            {copied ? t('linkCopied') : t('copyLink')}
          </Button>
        }
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
                { value: 'S', label: 'Tier S' },
                { value: 'A', label: 'Tier A' },
                { value: 'B', label: 'Tier B' },
                { value: 'C', label: 'Tier C' },
                { value: 'D', label: 'Tier D' },
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
      <WorkTimeLadder
        rows={rows}
        profile={profile}
        activeHoursPerDay={activeHoursPerDay}
        minTier={tier}
      />

      {/* Bar Chart */}
      <BudgetBarChart rows={rows} profile={profile} metric={metric} minTier={tier} />

      {/* Full Table */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-display">
            {t('tableTitle')}
          </h2>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider select-none">
              <tr>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
                  onClick={() => handleSort('modelName')}
                >
                  {t('col.model')}
                </th>
                <th className="px-4 py-3">{t('col.channel')}</th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
                  onClick={() => handleSort('credit')}
                >
                  {t('col.credit')}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
                  onClick={() => handleSort('tasks')}
                >
                  {t('col.tasks')}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
                  onClick={() => handleSort('workDays')}
                >
                  {t('col.workDays')}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
                  onClick={() => handleSort('coverageOfMonth')}
                >
                  {t('col.coverage')}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
                  onClick={() => handleSort('tokens')}
                >
                  {t('col.tokens')}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
                  onClick={() => handleSort('generationHours')}
                >
                  {t('col.genHours')}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100"
                  onClick={() => handleSort('quality')}
                >
                  {t('col.quality')}
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
                    {r.isFree ? t('freeInfinity') : `${r.workDays.toFixed(1)} d`}
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
              Subskrypcje vs API
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
