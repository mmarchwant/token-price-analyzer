import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, ErrorState, PageHeader, Skeleton } from '../../components/ui';
import { useHistoryIndexQuery, usePriceHistoryQuery } from '../../data/history';
import { useMoney } from '../../data/hooks';
import { historyChartPoints, historyItems, percentChange, type HistoryKind } from './historyView';

export default function HistoryPage() {
  const { t } = useTranslation('history');
  const { currency, fmtPerMTok } = useMoney();
  const indexQuery = useHistoryIndexQuery();
  const years = indexQuery.data?.years ?? [];
  const [year, setYear] = useState<number>();
  const [kind, setKind] = useState<HistoryKind>('models');
  const [itemId, setItemId] = useState<string>();
  const selectedYear = year !== undefined && years.includes(year) ? year : years.at(-1);
  const historyQuery = usePriceHistoryQuery(selectedYear);
  const items = useMemo(
    () => (historyQuery.data ? historyItems(historyQuery.data, kind) : []),
    [historyQuery.data, kind],
  );

  const selectedItemId = items.some((item) => item.id === itemId) ? itemId : items[0]?.id;

  const chartPoints = useMemo(
    () => (historyQuery.data ? historyChartPoints(historyQuery.data, kind, selectedItemId) : []),
    [historyQuery.data, kind, selectedItemId],
  );
  const first = chartPoints[0];
  const last = chartPoints.at(-1);
  const change =
    kind === 'models'
      ? percentChange(first?.input, last?.input)
      : percentChange(first?.price, last?.price);

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {indexQuery.isLoading ? <Skeleton className="h-80 w-full rounded-xl" /> : null}
      {indexQuery.isError ? (
        <ErrorState message={t('errors.index')} onRetry={() => void indexQuery.refetch()} />
      ) : null}
      {!indexQuery.isLoading && !indexQuery.isError && years.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('empty')}</p>
          </CardContent>
        </Card>
      ) : null}

      {years.length > 0 ? (
        <Card>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <label
                className="space-y-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                htmlFor="history-year"
              >
                {t('controls.year')}
                <select
                  id="history-year"
                  value={selectedYear ?? ''}
                  onChange={(event) => setYear(Number(event.target.value))}
                  className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {[...years].reverse().map((availableYear) => (
                    <option key={availableYear} value={availableYear}>
                      {availableYear}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="space-y-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                htmlFor="history-kind"
              >
                {t('controls.category')}
                <select
                  id="history-kind"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as HistoryKind)}
                  className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="models">{t('categories.models')}</option>
                  <option value="subscriptions">{t('categories.subscriptions')}</option>
                </select>
              </label>
              <label
                className="space-y-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                htmlFor="history-item"
              >
                {t('controls.item')}
                <select
                  id="history-item"
                  value={selectedItemId ?? ''}
                  onChange={(event) => setItemId(event.target.value)}
                  disabled={items.length === 0}
                  className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {historyQuery.isLoading ? <Skeleton className="h-80 w-full rounded-xl" /> : null}
            {historyQuery.isError ? (
              <ErrorState message={t('errors.year')} onRetry={() => void historyQuery.refetch()} />
            ) : null}
            {!historyQuery.isLoading && !historyQuery.isError && items.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-600 dark:text-zinc-400">
                {t('emptyCategory')}
              </p>
            ) : null}
            {chartPoints.length > 0 ? (
              <>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <HistoryStat label={t('stats.firstSeen')} value={first?.date ?? '—'} />
                  <HistoryStat label={t('stats.lastUpdated')} value={last?.date ?? '—'} />
                  <HistoryStat
                    label={t('stats.change')}
                    value={
                      change === undefined ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
                    }
                    tone={
                      change === undefined || change === 0 ? undefined : change < 0 ? 'good' : 'bad'
                    }
                  />
                </dl>
                <div
                  className="h-80"
                  role="img"
                  aria-label={t('chart.ariaLabel', { item: selectedItemId })}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartPoints}
                      margin={{ top: 16, right: 20, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis
                        fontSize={11}
                        tickFormatter={(value) => fmtPerMTok(Number(value))}
                        width={70}
                      />
                      <Tooltip
                        formatter={(value: unknown) =>
                          typeof value === 'number' ? fmtPerMTok(value) : '—'
                        }
                      />
                      <Legend />
                      {kind === 'models' ? (
                        <>
                          <Line
                            type="stepAfter"
                            dataKey="input"
                            name={t('chart.input')}
                            stroke="#4f46e5"
                            strokeWidth={2}
                            dot
                          />
                          <Line
                            type="stepAfter"
                            dataKey="output"
                            name={t('chart.output')}
                            stroke="#0d9488"
                            strokeWidth={2}
                            dot
                          />
                        </>
                      ) : (
                        <Line
                          type="stepAfter"
                          dataKey="price"
                          name={t('chart.subscription')}
                          stroke="#4f46e5"
                          strokeWidth={2}
                          dot
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('unitNote', { currency })}
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function HistoryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd
        className={`mt-1 font-semibold tabular-nums ${
          tone === 'good'
            ? 'text-emerald-700 dark:text-emerald-300'
            : tone === 'bad'
              ? 'text-rose-700 dark:text-rose-300'
              : 'text-zinc-900 dark:text-zinc-100'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
