import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Tooltip } from '../../../components/ui';
import { useMoney } from '../../../data/hooks';
import type { UsageProfile } from '../../../domain/types';
import type { ExplorerRow } from '../explorerRows';

export interface ExplorerTableProps {
  rows: ExplorerRow[];
  activeProfile: UsageProfile;
  sort: string;
  dir: 'asc' | 'desc';
  onSortChange: (sort: string, dir: 'asc' | 'desc') => void;
  page: number;
  onPageChange: (page: number) => void;
  onSelectRow: (row: ExplorerRow) => void;
}

export function ExplorerTable({
  rows,
  activeProfile,
  sort,
  dir,
  onSortChange,
  page,
  onPageChange,
  onSelectRow,
}: ExplorerTableProps) {
  const { t } = useTranslation('explorer');
  const { fmt, fmtPerMTok, fmtTokens } = useMoney();

  const sortingState: SortingState = useMemo(() => {
    return [{ id: sort, desc: dir === 'desc' }];
  }, [sort, dir]);

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

  const columns = useMemo<ColumnDef<ExplorerRow>[]>(() => {
    return [
      {
        id: 'model',
        accessorFn: (r: ExplorerRow) => r.model.name,
        header: () => t('columns.model', 'Model'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-col gap-1 py-1 font-sans">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.model.name}</span>
                {r.isFree && <Badge variant="success">{t('badges.free', 'Free')}</Badge>}
                {r.openWeights && (
                  <Badge variant="info">{t('badges.openWeights', 'Open Weights')}</Badge>
                )}
                {r.isNew && <Badge variant="warning">{t('badges.new', 'New')}</Badge>}
                {r.offer.channel === 'openrouter-batch' && (
                  <Badge variant="neutral">{t('badges.batch', 'Batch')}</Badge>
                )}
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {r.model.providerName}
              </span>
            </div>
          );
        },
      },
      {
        id: 'inputPerMTok',
        accessorKey: 'inputPerMTok',
        header: () => t('columns.input', 'Input /1M'),
        cell: ({ row }) => fmtPerMTok(row.original.inputPerMTok),
      },
      {
        id: 'outputPerMTok',
        accessorKey: 'outputPerMTok',
        header: () => t('columns.output', 'Output /1M'),
        cell: ({ row }) => fmtPerMTok(row.original.outputPerMTok),
      },
      {
        id: 'cacheReadPerMTok',
        accessorKey: 'cacheReadPerMTok',
        header: () => t('columns.cache', 'Cache Read /1M'),
        cell: ({ row }) =>
          row.original.cacheReadPerMTok !== undefined
            ? fmtPerMTok(row.original.cacheReadPerMTok)
            : '—',
      },
      {
        id: 'effectivePerMTok',
        accessorKey: 'effectivePerMTok',
        header: () => (
          <Tooltip
            content={t(
              'tooltips.effective',
              'Blended cost per 1M tokens based on your profile input/output ratio',
            )}
          >
            <span className="cursor-help underline decoration-dotted">
              {t('columns.effective', 'Effective /1M')}
            </span>
          </Tooltip>
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {fmtPerMTok(row.original.effectivePerMTok)}
          </span>
        ),
      },
      {
        id: 'costPerTask',
        accessorKey: 'costPerTask',
        header: () => t('columns.costPerTask', 'Cost / Task'),
        cell: ({ row }) => fmt(row.original.costPerTask),
      },
      {
        id: 'monthlyCost',
        accessorKey: 'monthlyCost',
        header: () => t('columns.monthlyCost', 'Monthly Cost'),
        cell: ({ row }) => fmt(row.original.monthlyCost),
      },
      {
        id: 'quality',
        accessorKey: 'quality',
        header: () => (
          <Tooltip
            content={t(
              'tooltips.quality',
              'Quality scores from Artificial Analysis (dimension: {{dim}})',
              { dim: activeProfile.qualityDimension },
            )}
          >
            <span className="cursor-help underline decoration-dotted">
              {t('columns.quality', 'Quality')}
            </span>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const q = row.original.quality;
          const tier = row.original.tier;
          return (
            <div className="flex items-center gap-1.5 font-sans">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {q !== undefined ? q : '—'}
              </span>
              {tier && <Badge variant={getTierVariant(tier)}>{tier}</Badge>}
            </div>
          );
        },
      },
      {
        id: 'value',
        accessorFn: (r: ExplorerRow) => (r.isPareto ? 1000000 : 0) + (r.qualityPerDollar ?? 0),
        header: () => t('columns.value', 'Value'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-1 font-sans">
              {r.isPareto && (
                <Tooltip
                  content={t('tooltips.pareto', 'Pareto optimal: best quality for this cost tier')}
                >
                  <span className="text-amber-500 font-bold">★</span>
                </Tooltip>
              )}
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {r.qualityPerDollar !== null
                  ? Math.round(r.qualityPerDollar).toLocaleString()
                  : '—'}
              </span>
            </div>
          );
        },
      },
      {
        id: 'contextLength',
        accessorKey: 'contextLength',
        header: () => t('columns.context', 'Context'),
        cell: ({ row }) =>
          row.original.contextLength ? fmtTokens(row.original.contextLength) : '—',
      },
      {
        id: 'speed',
        accessorFn: (r: ExplorerRow) => r.speed?.outputTokensPerSecond ?? 0,
        header: () => t('columns.speed', 'Speed'),
        cell: ({ row }) => {
          const speed = row.original.speed?.outputTokensPerSecond;
          return speed ? `${Math.round(speed)} tok/s` : '—';
        },
      },
      {
        id: 'channel',
        accessorFn: (r: ExplorerRow) => r.offer.channel,
        header: () => t('columns.channel', 'Channel'),
        cell: ({ row }) => {
          const r = row.original;
          const allChannels = r.channelsAvailable.join(', ');
          return (
            <Tooltip
              content={t('tooltips.channel', 'Active offer: {{active}}. Available: {{all}}', {
                active: r.offer.channel,
                all: allChannels,
              })}
            >
              <span className="capitalize text-xs font-mono text-zinc-700 dark:text-zinc-300">
                {r.offer.channel}
              </span>
            </Tooltip>
          );
        },
      },
    ];
  }, [t, fmt, fmtPerMTok, fmtTokens, activeProfile.qualityDimension]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting: sortingState,
      pagination: {
        pageIndex: Math.max(0, page - 1),
        pageSize: 50,
      },
    },
    onSortingChange: (updater) => {
      const nextSorting = typeof updater === 'function' ? updater(sortingState) : updater;
      if (nextSorting.length > 0 && nextSorting[0]) {
        onSortChange(nextSorting[0].id, nextSorting[0].desc ? 'desc' : 'asc');
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
  });

  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageCount = table.getPageCount();

  return (
    <div className="space-y-4 font-sans">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
        <table className="w-full text-left text-sm font-sans border-collapse">
          <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800/90 backdrop-blur-xs text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, idx) => {
                  const isSorted = header.column.getIsSorted();
                  const isFirstCol = idx === 0;
                  return (
                    <th
                      key={header.id}
                      className={`p-3 font-semibold text-xs whitespace-nowrap ${
                        header.column.getCanSort()
                          ? 'cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-700/50'
                          : ''
                      } ${
                        isFirstCol
                          ? 'sticky left-0 bg-zinc-50 dark:bg-zinc-800 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'
                          : ''
                      }`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {isSorted && (
                          <span className="text-indigo-600 dark:text-indigo-400">
                            {isSorted === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onSelectRow(row.original)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSelectRow(row.original);
                    }
                  }}
                  tabIndex={0}
                  className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors focus:bg-indigo-50/60 dark:focus:bg-indigo-950/40 focus:outline-hidden"
                >
                  {row.getVisibleCells().map((cell, idx) => {
                    const isFirstCol = idx === 0;
                    return (
                      <td
                        key={cell.id}
                        className={`p-3 whitespace-nowrap ${
                          isFirstCol
                            ? 'sticky left-0 bg-white dark:bg-zinc-900 group-hover:bg-indigo-50/40 dark:group-hover:bg-indigo-950/20 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'
                            : ''
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-zinc-500">
                  {t('noResults', 'No models match your filter criteria.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards List (< md) */}
      <div className="block md:hidden space-y-3 font-sans">
        {table.getRowModel().rows.length > 0 ? (
          table.getRowModel().rows.map((row) => {
            const r = row.original;
            return (
              <div
                key={row.id}
                onClick={() => onSelectRow(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSelectRow(r);
                  }
                }}
                tabIndex={0}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs cursor-pointer hover:border-indigo-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 flex-wrap">
                      {r.model.name}
                      {r.isPareto && <span className="text-amber-500 text-xs">★ Best Deal</span>}
                    </h3>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {r.model.providerName}
                    </span>
                  </div>
                  {r.tier && <Badge variant={getTierVariant(r.tier)}>Tier {r.tier}</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-lg">
                  <div>
                    <span className="text-zinc-500 block">
                      {t('columns.effective', 'Effective /1M')}
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {fmtPerMTok(r.effectivePerMTok)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">
                      {t('columns.costPerTask', 'Cost / Task')}
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {fmt(r.costPerTask)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">{t('columns.quality', 'Quality')}</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {r.quality ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">{t('columns.channel', 'Channel')}</span>
                    <span className="capitalize font-mono text-zinc-800 dark:text-zinc-200">
                      {r.offer.channel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-zinc-500 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            {t('noResults', 'No models match your filter criteria.')}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm text-zinc-600 dark:text-zinc-400 font-sans">
          <span>
            {t('pagination.pageOf', 'Page {{current}} of {{total}}', {
              current: currentPage,
              total: pageCount,
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => onPageChange(currentPage - 1)}
            >
              {t('pagination.prev', 'Previous')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!table.getCanNextPage()}
              onClick={() => onPageChange(currentPage + 1)}
            >
              {t('pagination.next', 'Next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
