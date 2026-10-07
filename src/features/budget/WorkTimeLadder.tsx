import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Badge, Card, CardContent, CardHeader } from '../../components/ui';
import type { BudgetRow } from './budgetRows';
import type { QualityTier, UsageProfile } from '../../domain/types';
import { meetsMinTier } from '../../domain/quality';

export interface WorkTimeLadderProps {
  rows: BudgetRow[];
  profile: UsageProfile;
  activeHoursPerDay?: number;
  minTier: QualityTier;
}

const TIER_COLORS: Record<QualityTier, string> = {
  S: 'bg-indigo-600 text-white dark:bg-indigo-500',
  A: 'bg-emerald-600 text-white dark:bg-emerald-500',
  B: 'bg-blue-600 text-white dark:bg-blue-500',
  C: 'bg-amber-600 text-white dark:bg-amber-500',
  D: 'bg-red-600 text-white dark:bg-red-500',
};

export const WorkTimeLadder: React.FC<WorkTimeLadderProps> = ({
  rows,
  profile,
  activeHoursPerDay = 8,
  minTier,
}) => {
  const { t } = useTranslation('budget');

  const top20 = useMemo(() => {
    return rows
      .filter((r) => meetsMinTier(r.tier, minTier))
      .sort((a, b) => {
        if (b.workDays !== a.workDays) {
          return b.workDays - a.workDays;
        }
        return (b.quality ?? 0) - (a.quality ?? 0);
      })
      .slice(0, 20);
  }, [rows, minTier]);

  const ticks = useMemo(() => {
    const monthDays = profile.workDaysPerMonth || 20;
    return [
      { key: 'hour', days: 1 / activeHoursPerDay, label: t('ladderTicks.hour') },
      { key: 'day', days: 1, label: t('ladderTicks.day') },
      { key: 'week', days: 5, label: t('ladderTicks.week') },
      { key: 'month', days: monthDays, label: t('ladderTicks.month') },
      { key: 'year', days: 12 * monthDays, label: t('ladderTicks.year') },
      { key: 'free', days: Number.POSITIVE_INFINITY, label: t('ladderTicks.free') },
    ];
  }, [profile, activeHoursPerDay, t]);

  const getLogPos = (workDays: number): number => {
    if (workDays === Number.POSITIVE_INFINITY || !Number.isFinite(workDays)) {
      return 96;
    }
    const minVal = 0.05;
    const maxVal = 300;
    const clamped = Math.max(minVal, Math.min(maxVal, workDays));
    const logMin = Math.log10(minVal);
    const logMax = Math.log10(maxVal);
    const frac = (Math.log10(clamped) - logMin) / (logMax - logMin);
    return Math.min(88, Math.max(4, frac * 84 + 4));
  };

  const positionedModels = useMemo(() => {
    const items = top20.map((r) => ({
      row: r,
      pos: getLogPos(r.workDays),
      level: 0,
    }));

    items.sort((a, b) => a.pos - b.pos);

    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1]!;
      const curr = items[i]!;
      if (Math.abs(curr.pos - prev.pos) < 5) {
        curr.level = (prev.level + 1) % 3;
      }
    }

    return items;
  }, [top20]);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-display">
          {t('ladderTitle')}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('ladderSubtitle')}</p>
      </CardHeader>
      <CardContent>
        {/* Accessible screen reader alternative */}
        <div className="sr-only">
          <h3>{t('ladderTitle')}</h3>
          <ul>
            {top20.map((r) => (
              <li key={`${r.model.id}-${r.offer.channel}`}>
                {r.model.name} ({r.tier}):{' '}
                {r.workDays === Number.POSITIVE_INFINITY
                  ? t('ladderTicks.free')
                  : `${r.workDays.toFixed(1)} ${t('metrics.days')}`}
              </li>
            ))}
          </ul>
        </div>

        {/* Desktop / Horizontal View (hidden below md) */}
        <div className="hidden md:block relative pt-12 pb-16 px-4">
          {/* Axis line */}
          <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full relative">
            {/* Ticks */}
            {ticks.map((tick) => {
              const pos = getLogPos(tick.days);
              return (
                <div
                  key={tick.key}
                  className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: `${pos}%` }}
                >
                  <div className="w-1 h-4 bg-zinc-400 dark:bg-zinc-600 rounded-full" />
                  <span className="absolute top-5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                    {tick.label}
                  </span>
                </div>
              );
            })}

            {/* Model Markers */}
            {positionedModels.map(({ row, pos, level }) => {
              const levelOffset = level * 32;
              return (
                <div
                  key={`${row.model.id}-${row.offer.channel}`}
                  className="absolute top-0 -translate-x-1/2 group z-10 hover:z-30 cursor-pointer transition-all"
                  style={{ left: `${pos}%` }}
                >
                  <div
                    className="flex flex-col items-center absolute"
                    style={{ bottom: `${8 + levelOffset}px` }}
                  >
                    <span
                      className={clsx(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium shadow-xs whitespace-nowrap flex items-center gap-1',
                        TIER_COLORS[row.tier],
                      )}
                    >
                      <span>{row.model.name}</span>
                      <span className="opacity-80">
                        {t('daysShort', {
                          d:
                            row.workDays === Number.POSITIVE_INFINITY
                              ? '∞'
                              : row.workDays >= 10
                                ? Math.round(row.workDays)
                                : row.workDays.toFixed(1),
                        })}
                      </span>
                    </span>
                    <div className="w-0.5 h-2 bg-zinc-400 dark:bg-zinc-500" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile / Vertical View (visible below md) */}
        <div className="block md:hidden space-y-2">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 pb-2 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
            <span>{t('col.model')}</span>
            <span>{t('metrics.days')}</span>
          </div>
          {top20.map((r) => (
            <div
              key={`${r.model.id}-${r.offer.channel}`}
              className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-100 dark:border-zinc-800/60"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <Badge className={TIER_COLORS[r.tier]}>{r.tier}</Badge>
                <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {r.model.name}
                </span>
              </div>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0 tabular-nums">
                {r.workDays === Number.POSITIVE_INFINITY
                  ? t('ladderTicks.free')
                  : t('daysShort', { d: r.workDays.toFixed(1) })}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
