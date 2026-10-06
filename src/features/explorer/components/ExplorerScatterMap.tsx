import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Badge } from '../../../components/ui';
import { useAppData } from '../../../data/AppData';
import { useMoney } from '../../../data/hooks';
import { applyVat, convertFromUsd } from '../../../domain/currency';
import { useSettingsStore } from '../../../state/settings';
import type { ExplorerRow } from '../explorerRows';

export interface ExplorerScatterMapProps {
  rows: ExplorerRow[];
  onSelectRow: (row: ExplorerRow) => void;
}

interface ScatterPoint {
  x: number;
  y: number;
  z: number;
  row: ExplorerRow;
  name: string;
  provider: string;
  tier: string;
  isPareto: boolean;
}

const TIER_COLORS: Record<string, string> = {
  S: '#6366f1', // Indigo
  A: '#10b981', // Emerald
  B: '#0284c7', // Sky
  C: '#f59e0b', // Amber
  D: '#ef4444', // Red
};

export function ExplorerScatterMap({ rows, onSelectRow }: ExplorerScatterMapProps) {
  const { t } = useTranslation('explorer');
  const { fx } = useAppData();
  const currency = useSettingsStore((state) => state.currency);
  const vatRatePct = useSettingsStore((state) => state.vatRatePct);
  const { fmt } = useMoney();

  const [paretoOpen, setParetoOpen] = useState(false);

  // Filter rows with valid quality score
  const chartData = useMemo<ScatterPoint[]>(() => {
    return rows
      .filter((r) => r.quality !== undefined)
      .map((r) => {
        const convertedCost = applyVat(convertFromUsd(r.costPerTask, currency, fx), vatRatePct);
        const safeX = convertedCost > 0 ? convertedCost : 0.000001;

        return {
          x: safeX,
          y: r.quality!,
          z: r.isPareto ? 80 : 40,
          row: r,
          name: r.model.name,
          provider: r.model.providerName,
          tier: r.tier ?? 'B',
          isPareto: r.isPareto,
        };
      });
  }, [rows, currency, fx, vatRatePct]);

  const paretoRows = useMemo(() => {
    return rows.filter((r) => r.isPareto && r.quality !== undefined);
  }, [rows]);

  const getTierVariant = (tier?: string) => {
    switch (tier) {
      case 'S':
        return 'accent';
      case 'A':
        return 'success';
      case 'B':
        return 'info';
      case 'C':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Main Chart Container */}
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 rounded-xl shadow-xs space-y-4"
        aria-label={t(
          'map.ariaLabel',
          'Cost vs Quality Scatter Chart showing model value distribution',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {t('map.title', 'Cost vs. Quality Map')}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('map.subtitle', 'Log-scale cost per task ({{currency}}) vs Quality Score', {
                currency,
              })}
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-300" />
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {t('map.paretoLegend', 'Pareto Frontier (Best Deals)')}
              </span>
            </span>
            <div className="hidden sm:flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-700 pl-3">
              {['S', 'A', 'B', 'C', 'D'].map((tier) => (
                <span key={tier} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: TIER_COLORS[tier] }}
                  />
                  <span className="text-zinc-500">{tier}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="w-full h-96 sm:h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Cost per task"
                  scale="log"
                  domain={['auto', 'auto']}
                  unit={` ${currency}`}
                  tickFormatter={(v: number) => (v < 0.01 ? v.toPrecision(2) : v.toFixed(3))}
                  stroke="#71717a"
                  fontSize={12}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Quality Score"
                  domain={[0, 100]}
                  stroke="#71717a"
                  fontSize={12}
                />
                <ZAxis type="number" dataKey="z" range={[40, 100]} />
                <RechartsTooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const item = payload[0]?.payload as ScatterPoint | undefined;
                    if (!item) return null;

                    return (
                      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3 rounded-lg shadow-md text-xs space-y-1 font-sans">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                          {item.name}
                          {item.isPareto && <span className="text-amber-500">★</span>}
                        </div>
                        <div className="text-zinc-500">{item.provider}</div>
                        <div className="pt-1 border-t border-zinc-100 dark:border-zinc-700 grid grid-cols-2 gap-x-3 gap-y-0.5">
                          <span>{t('columns.costPerTask', 'Cost / Task')}:</span>
                          <span className="font-semibold text-right">
                            {fmt(item.row.costPerTask)}
                          </span>
                          <span>{t('columns.monthlyCost', 'Monthly Cost')}:</span>
                          <span className="font-semibold text-right">
                            {fmt(item.row.monthlyCost)}
                          </span>
                          <span>{t('columns.quality', 'Quality Score')}:</span>
                          <span className="font-semibold text-right">{item.y}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  name="Models"
                  data={chartData}
                  onClick={(node) => {
                    const point = (node as { payload?: ScatterPoint })?.payload;
                    if (point?.row) {
                      onSelectRow(point.row);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isPareto ? '#f59e0b' : TIER_COLORS[entry.tier] || '#6366f1'}
                      opacity={entry.isPareto ? 1.0 : 0.45}
                      stroke={entry.isPareto ? '#d97706' : undefined}
                      strokeWidth={entry.isPareto ? 2 : 0}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-12 text-center text-zinc-500">
            {t('noResults', 'No models match your filter criteria.')}
          </div>
        )}
      </div>

      {/* Accessible Collapsible Pareto Frontier List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 font-sans">
        <button
          type="button"
          onClick={() => setParetoOpen(!paretoOpen)}
          className="w-full flex items-center justify-between font-bold text-zinc-900 dark:text-zinc-100 text-sm focus:outline-hidden cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <span>★</span>
            <span>
              {t('map.paretoFrontierTitle', 'Pareto-optimal models (Best Deals)')} (
              {paretoRows.length})
            </span>
          </span>
          <span>{paretoOpen ? '▲' : '▼'}</span>
        </button>

        {paretoOpen && (
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
            {paretoRows.map((r) => (
              <div
                key={r.model.id}
                onClick={() => onSelectRow(r)}
                className="py-2.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 p-2 rounded cursor-pointer transition-colors"
              >
                <div>
                  <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    {r.model.name}
                    {r.tier && <Badge variant={getTierVariant(r.tier)}>Tier {r.tier}</Badge>}
                  </div>
                  <div className="text-xs text-zinc-500">{r.model.providerName}</div>
                </div>

                <div className="text-right text-xs">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {fmt(r.costPerTask)} / task
                  </div>
                  <div className="text-zinc-500">Quality: {r.quality}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
