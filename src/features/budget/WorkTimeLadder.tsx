import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Badge, Card, CardContent, CardHeader } from '../../components/ui';
import { CopyNameButton } from '../../components/ui/CopyNameButton';
import type { BudgetRow } from './budgetRows';
import type { QualityTier } from '../../domain/types';
import { meetsMinTier } from '../../domain/quality';

export interface WorkTimeLadderProps {
  rows: BudgetRow[];
  minTier: QualityTier;
}

const TIER_COLORS: Record<QualityTier, string> = {
  S: 'bg-indigo-600 text-white dark:bg-indigo-500',
  A: 'bg-emerald-600 text-white dark:bg-emerald-500',
  B: 'bg-blue-600 text-white dark:bg-blue-500',
  C: 'bg-amber-600 text-white dark:bg-amber-500',
  D: 'bg-red-600 text-white dark:bg-red-500',
};

export const WorkTimeLadder: React.FC<WorkTimeLadderProps> = ({ rows, minTier }) => {
  const { t } = useTranslation('budget');

  const top20 = useMemo(
    () =>
      rows
        .filter((row) => meetsMinTier(row.tier, minTier))
        .sort((a, b) => b.workDays - a.workDays || (b.quality ?? 0) - (a.quality ?? 0))
        .slice(0, 20),
    [rows, minTier],
  );

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {t('ladderTitle')}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('ladderSubtitle')}</p>
      </CardHeader>
      <CardContent>
        {top20.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            {t('highlights.noModel')}
          </p>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-2">
            {top20.map((row, index) => (
              <li
                key={`${row.model.id}-${row.offer.channel}`}
                className="flex min-w-0 items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-400">
                  {index + 1}
                </span>
                <Badge className={clsx('shrink-0', TIER_COLORS[row.tier])}>{row.tier}</Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {row.model.name}
                </span>
                <CopyNameButton
                  text={row.model.name}
                  ariaLabel={t('copyModelName', { name: row.model.name })}
                  copiedLabel={t('modelNameCopied')}
                />
                <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                  {row.workDays === Number.POSITIVE_INFINITY
                    ? t('ladderTicks.free')
                    : t('daysShort', { d: row.workDays.toFixed(1) })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
};
