import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, Card, CardContent, CardHeader } from '../../components/ui';
import { useAppData } from '../../data/AppData';
import { useMoney } from '../../data/hooks';
import { breakEvenTasks, capacityTasks, planPrice } from '../../domain/subscriptions';
import { costPerTask, selectOffer, taskFromProfile } from '../../domain/pricing';
import type { ModelEntry, PriceOffer, SubscriptionPlan, UsageProfile } from '../../domain/types';

export interface BreakEvenChartProps {
  selectedPlans: SubscriptionPlan[];
  profile: UsageProfile;
  activeHoursPerDay: number;
  bestValueModel?: { model: ModelEntry; offer: PriceOffer };
}

const PLAN_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
const API_COLORS = ['#3b82f6', '#06b6d4', '#14b8a6'];

export const BreakEvenChart: React.FC<BreakEvenChartProps> = ({
  selectedPlans,
  profile,
  activeHoursPerDay,
  bestValueModel,
}) => {
  const { t, i18n } = useTranslation('subscriptions');
  const { models, fx } = useAppData();
  const { fmt, currency, isVatApplied, fmtTokens } = useMoney();
  const [showSummary, setShowSummary] = useState(false);

  const lang = i18n.language?.startsWith('pl') ? 'pl' : 'en';
  const workDaysPerMonth = profile.workDaysPerMonth || 20;
  const demandTasks = profile.tasksPerDay * workDaysPerMonth;
  const task = taskFromProfile(profile);

  // Compute plan capabilities and prices
  const planDetails = useMemo(() => {
    return selectedPlans.map((plan, idx) => {
      const primaryModel = models.find((m) => m.id === plan.primaryModelId);
      const primaryOffer = primaryModel
        ? selectOffer(primaryModel, task, { includeFree: false, includeBatch: false })
        : undefined;

      const priceInfo = planPrice(plan, currency, fx, isVatApplied ? 23 : 0);
      const cap = capacityTasks(plan, profile, primaryOffer, {
        activeHoursPerDay,
        workDaysPerMonth,
      });

      return {
        plan,
        color: PLAN_COLORS[idx % PLAN_COLORS.length]!,
        price: priceInfo.amount,
        priceUsd: plan.priceUsdMonthly,
        primaryModel,
        primaryOffer,
        cap,
      };
    });
  }, [
    selectedPlans,
    models,
    task,
    currency,
    fx,
    isVatApplied,
    profile,
    activeHoursPerDay,
    workDaysPerMonth,
  ]);

  // Unique API models to plot
  const apiSeries = useMemo(() => {
    const list: {
      id: string;
      label: string;
      offer: PriceOffer;
      costPerTaskUsd: number;
      costPerTaskDisplay: number;
      color: string;
    }[] = [];

    let colorIdx = 0;

    // Add selected plans' primary models
    for (const detail of planDetails) {
      if (detail.primaryOffer && detail.primaryModel) {
        if (!list.some((item) => item.offer.sourceId === detail.primaryOffer!.sourceId)) {
          const cUsd = costPerTask(task, detail.primaryOffer);
          const priceObj = planPrice(
            { priceUsdMonthly: cUsd } as SubscriptionPlan,
            currency,
            fx,
            isVatApplied ? 23 : 0,
          );
          list.push({
            id: `api-${detail.primaryModel.id}`,
            label: `API: ${detail.primaryModel.name}`,
            offer: detail.primaryOffer,
            costPerTaskUsd: cUsd,
            costPerTaskDisplay: priceObj.amount,
            color: API_COLORS[colorIdx % API_COLORS.length]!,
          });
          colorIdx++;
        }
      }
    }

    // Add best value model if distinct
    if (bestValueModel) {
      if (!list.some((item) => item.offer.sourceId === bestValueModel.offer.sourceId)) {
        const cUsd = costPerTask(task, bestValueModel.offer);
        const priceObj = planPrice(
          { priceUsdMonthly: cUsd } as SubscriptionPlan,
          currency,
          fx,
          isVatApplied ? 23 : 0,
        );
        list.push({
          id: `api-best-${bestValueModel.model.id}`,
          label: `API: ${bestValueModel.model.name} (${lang === 'pl' ? 'najlepsza wartość' : 'best value'})`,
          offer: bestValueModel.offer,
          costPerTaskUsd: cUsd,
          costPerTaskDisplay: priceObj.amount,
          color: API_COLORS[colorIdx % API_COLORS.length]!,
        });
      }
    }

    return list;
  }, [planDetails, bestValueModel, task, currency, fx, isVatApplied, lang]);

  // Calculate maximum X bound
  const maxX = useMemo(() => {
    let maxCapHigh = 0;
    for (const d of planDetails) {
      if (d.cap) {
        maxCapHigh = Math.max(maxCapHigh, d.cap.high);
      }
    }
    return Math.max(3 * demandTasks, maxCapHigh, 1000);
  }, [demandTasks, planDetails]);

  // Generate chart data points along X
  const chartData = useMemo(() => {
    const steps = 30;
    const points: Record<string, number | null>[] = [];

    // Specific critical X values to include
    const criticalX = new Set<number>([0, demandTasks, maxX]);
    for (const d of planDetails) {
      if (d.cap) {
        if (d.cap.low <= maxX) criticalX.add(d.cap.low);
        if (d.cap.high <= maxX) criticalX.add(d.cap.high);
      }
    }

    // Regular interval steps
    for (let i = 0; i <= steps; i++) {
      const x = Math.round((i / steps) * maxX);
      criticalX.add(x);
    }

    const sortedX = Array.from(criticalX).sort((a, b) => a - b);

    for (const x of sortedX) {
      const row: Record<string, number | null> = { tasks: x };

      // Plan lines: solid up to low, dashed from low to high
      for (const d of planDetails) {
        const keySolid = `${d.plan.id}_solid`;
        const keyDashed = `${d.plan.id}_dashed`;

        if (!d.cap) {
          // Unknown limit: plot flat line across full range
          row[keySolid] = d.price;
          row[keyDashed] = null;
        } else {
          if (x <= d.cap.low) {
            row[keySolid] = d.price;
            row[keyDashed] = null;
          } else if (x <= d.cap.high) {
            row[keySolid] = null;
            row[keyDashed] = d.price;
            // Bridge point at low bound
            if (x === d.cap.low) {
              row[keyDashed] = d.price;
            }
          } else {
            row[keySolid] = null;
            row[keyDashed] = null;
          }
        }
      }

      // API lines
      for (const api of apiSeries) {
        row[api.id] = x * api.costPerTaskDisplay;
      }

      points.push(row);
    }

    return points;
  }, [demandTasks, maxX, planDetails, apiSeries]);

  return (
    <Card className="border-zinc-200 dark:border-zinc-800">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-display">
              {t('chart.title')}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('chart.subtitle')}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSummary((prev) => !prev)}
            aria-expanded={showSummary}
          >
            {showSummary ? t('chart.hideSummary') : t('chart.showSummary')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {selectedPlans.length === 0 ? (
          <p className="text-xs text-zinc-500 py-8 text-center">
            {lang === 'pl'
              ? 'Wybierz co najmniej jeden plan z kart powyżej, aby zobaczyć wykres.'
              : 'Select at least one plan from the cards above to render the break-even chart.'}
          </p>
        ) : (
          <div className="w-full h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="tasks"
                  type="number"
                  domain={[0, maxX]}
                  tickFormatter={(v) => fmtTokens(v)}
                  stroke="#888888"
                  fontSize={11}
                  label={{
                    value: t('chart.xAxis'),
                    position: 'insideBottom',
                    offset: -10,
                    fill: '#888888',
                    fontSize: 11,
                  }}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={11}
                  tickFormatter={(v) => fmt(v, { compact: true })}
                  label={{
                    value: t('chart.yAxis'),
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#888888',
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => {
                    if (typeof value === 'number') {
                      return [fmt(value), String(name)];
                    }
                    return ['—', String(name)];
                  }}
                  labelFormatter={(label) =>
                    `${t('chart.xAxis')}: ${Number(label).toLocaleString()}`
                  }
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #18181b)',
                    borderColor: '#27272a',
                    borderRadius: '0.5rem',
                    color: '#f4f4f5',
                    fontSize: '0.75rem',
                  }}
                />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: '11px' }} />

                <ReferenceLine
                  x={demandTasks}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: t('chart.demandLine', { tasks: fmtTokens(demandTasks) }),
                    fill: '#f59e0b',
                    fontSize: 10,
                    position: 'top',
                  }}
                />

                {/* Plan solid lines */}
                {planDetails.map((d) => (
                  <Line
                    key={`${d.plan.id}_solid`}
                    type="monotone"
                    dataKey={`${d.plan.id}_solid`}
                    name={`${d.plan.providerName} ${d.plan.name}`}
                    stroke={d.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                ))}

                {/* Plan dashed lines for estimated range */}
                {planDetails.map((d) => (
                  <Line
                    key={`${d.plan.id}_dashed`}
                    type="monotone"
                    dataKey={`${d.plan.id}_dashed`}
                    name={`${d.plan.name} (${t('confidence.estimated')})`}
                    stroke={d.color}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls={false}
                  />
                ))}

                {/* API lines */}
                {apiSeries.map((api) => (
                  <Line
                    key={api.id}
                    type="monotone"
                    dataKey={api.id}
                    name={api.label}
                    stroke={api.color}
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Collapsible Accessible Summary Table */}
        {showSummary && selectedPlans.length > 0 && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-display">
              {t('chart.summaryTitle')}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                    <th className="py-2 px-3">{t('chart.colPlan')}</th>
                    <th className="py-2 px-3">{t('chart.colPrice')}</th>
                    <th className="py-2 px-3">{t('chart.colApiModel')}</th>
                    <th className="py-2 px-3">{t('chart.colCostPerTask')}</th>
                    <th className="py-2 px-3">{t('chart.colBreakEven')}</th>
                    <th className="py-2 px-3">{t('chart.colVsDemand')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {planDetails.flatMap((d) => {
                    const apiMatches = apiSeries;
                    return apiMatches.map((api) => {
                      const be = breakEvenTasks(d.priceUsd, api.costPerTaskUsd);
                      const isInf = !Number.isFinite(be);
                      const vsDemandRatio = !isInf && demandTasks > 0 ? be / demandTasks : null;

                      return (
                        <tr
                          key={`${d.plan.id}-${api.id}`}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                        >
                          <td className="py-2 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                            {d.plan.providerName} {d.plan.name}
                          </td>
                          <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300">
                            {fmt(d.priceUsd)}
                          </td>
                          <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300">
                            {api.label}
                          </td>
                          <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300">
                            {fmt(api.costPerTaskUsd, { maxFractionDigits: 4 })}
                          </td>
                          <td className="py-2 px-3 font-semibold text-indigo-600 dark:text-indigo-400">
                            {isInf ? '∞' : Math.round(be).toLocaleString()} {t('chart.xAxis')}
                          </td>
                          <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400">
                            {vsDemandRatio !== null ? `${vsDemandRatio.toFixed(2)}× demand` : '—'}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
