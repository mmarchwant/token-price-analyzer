import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader } from '../../components/ui';
import type { BudgetRow } from './budgetRows';
import type { QualityTier, UsageProfile } from '../../domain/types';
import { monthlyTasks } from '../../domain/pricing';
import { meetsMinTier } from '../../domain/quality';
import { useMoney } from '../../data/hooks';

export interface BudgetBarChartProps {
  rows: BudgetRow[];
  profile: UsageProfile;
  metric: 'days' | 'tasks' | 'tokens';
  minTier: QualityTier;
}

const TIER_BAR_COLORS: Record<QualityTier, string> = {
  S: '#6366f1', // Indigo 500
  A: '#10b981', // Emerald 500
  B: '#3b82f6', // Blue 500
  C: '#f59e0b', // Amber 500
  D: '#ef4444', // Red 500
};

export const BudgetBarChart: React.FC<BudgetBarChartProps> = ({
  rows,
  profile,
  metric,
  minTier,
}) => {
  const { t } = useTranslation('budget');
  const { fmt, fmtTokens } = useMoney();

  const refValue = useMemo(() => {
    if (metric === 'days') {
      return profile.workDaysPerMonth || 20;
    }
    const mTasks = monthlyTasks(profile);
    if (metric === 'tasks') {
      return mTasks;
    }
    const tokensPerTask = profile.inputTokensPerTask + profile.outputTokensPerTask;
    return mTasks * tokensPerTask;
  }, [profile, metric]);

  const chartData = useMemo(() => {
    const eligible = rows.filter((r) => meetsMinTier(r.tier, minTier));

    const sorted = [...eligible].sort((a, b) => {
      let valA: number;
      let valB: number;
      if (metric === 'days') {
        valA = a.workDays;
        valB = b.workDays;
      } else if (metric === 'tasks') {
        valA = a.tasks;
        valB = b.tasks;
      } else {
        valA = a.tokens.inputTokens + a.tokens.outputTokens;
        valB = b.tokens.inputTokens + b.tokens.outputTokens;
      }
      if (valB !== valA) return valB - valA;
      return (b.quality ?? 0) - (a.quality ?? 0);
    });

    const top15 = sorted.slice(0, 15);

    return top15.map((r) => {
      let val: number;
      if (metric === 'days') {
        val = Number.isFinite(r.workDays) ? r.workDays : refValue * 3;
      } else if (metric === 'tasks') {
        val = Number.isFinite(r.tasks) ? r.tasks : refValue * 3;
      } else {
        const totalTok = r.tokens.inputTokens + r.tokens.outputTokens;
        val = Number.isFinite(totalTok) ? totalTok : refValue * 3;
      }

      return {
        id: `${r.model.id}-${r.offer.channel}`,
        name: r.model.name,
        value: val,
        isInfinite: r.isFree || !Number.isFinite(val),
        row: r,
      };
    });
  }, [rows, minTier, metric, refValue]);

  const fmtValue = (val: number, isInfinite?: boolean): string => {
    if (isInfinite) return t('freeInfinity');
    if (metric === 'days') return t('daysShort', { d: val.toFixed(1) });
    if (metric === 'tasks') return fmtTokens(Math.round(val));
    return fmtTokens(Math.round(val));
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-display">
          {t('chartTitle')}
        </h2>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-xs text-zinc-500 py-8 text-center">{t('highlights.noModel')}</p>
        ) : (
          <div className="w-full h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 10, right: 30, left: 100, bottom: 20 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v) =>
                    metric === 'days' ? t('daysShort', { d: v }) : fmtTokens(v)
                  }
                  stroke="#888888"
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 11 }}
                  stroke="#888888"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length || !payload[0]) return null;
                    const item = payload[0].payload as (typeof chartData)[0];
                    const r = item.row;
                    return (
                      <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-md text-xs space-y-1">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                        <p className="text-zinc-600 dark:text-zinc-400">
                          {t('col.channel')}:{' '}
                          <span className="font-semibold">{r.offer.channel}</span>
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-400">
                          {t('col.credit')}: <span className="font-semibold">{fmt(r.credit)}</span>
                        </p>
                        <p className="text-indigo-600 dark:text-indigo-400 font-semibold pt-1">
                          {t(`metrics.${metric}`)}: {fmtValue(item.value, item.isInfinite)}
                        </p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  x={refValue}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: t('refLineLabel', { value: fmtValue(refValue) }),
                    fill: '#f59e0b',
                    fontSize: 10,
                    position: 'top',
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.id} fill={TIER_BAR_COLORS[entry.row.tier]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
