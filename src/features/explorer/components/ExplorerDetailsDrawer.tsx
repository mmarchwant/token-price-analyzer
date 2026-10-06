import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button } from '../../../components/ui';
import { useMoney } from '../../../data/hooks';
import type { ExplorerRow } from '../explorerRows';

export interface ExplorerDetailsDrawerProps {
  row: ExplorerRow | null;
  onClose: () => void;
}

export function ExplorerDetailsDrawer({ row, onClose }: ExplorerDetailsDrawerProps) {
  const { t } = useTranslation('explorer');
  const { fmtPerMTok, fmtTokens } = useMoney();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (row) {
      window.addEventListener('keydown', handleKeyDown);
      drawerRef.current?.focus();
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [row, onClose]);

  if (!row) {
    return null;
  }

  const { model, offer } = row;

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
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div
          ref={drawerRef}
          tabIndex={-1}
          className="w-screen max-w-2xl bg-white dark:bg-zinc-900 shadow-xl flex flex-col focus:outline-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 p-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-sans">
                  {model.name}
                </h2>
                {row.isFree && <Badge variant="success">{t('badges.free', 'Free')}</Badge>}
                {row.openWeights && (
                  <Badge variant="info">{t('badges.openWeights', 'Open Weights')}</Badge>
                )}
                {row.isNew && <Badge variant="warning">{t('badges.new', 'New')}</Badge>}
                {offer.channel === 'openrouter-batch' && (
                  <Badge variant="neutral">{t('badges.batch', 'Batch')}</Badge>
                )}
                {row.isPareto && (
                  <Badge variant="accent">{t('badges.bestDeal', '★ Best Deal')}</Badge>
                )}
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-sans">
                {model.providerName} · ID:{' '}
                <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
                  {model.id}
                </code>
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label={t('drawer.close', 'Close')}
            >
              ✕
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans">
            {/* Description */}
            {model.description && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 font-sans">
                  {t('drawer.description', 'Description')}
                </h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 font-sans">
                  {model.description}
                </p>
              </div>
            )}

            {/* Quality scores */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 font-sans">
                {t('drawer.qualityScores', 'Quality Scores')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-sans">
                    {t('quality.tier', 'Tier')}
                  </span>
                  {row.tier ? (
                    <Badge variant={getTierVariant(row.tier)} className="mt-1">
                      Tier {row.tier}
                    </Badge>
                  ) : (
                    <span className="text-sm text-zinc-500">—</span>
                  )}
                </div>
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-sans">
                    {t('quality.intelligence', 'Intelligence')}
                  </span>
                  <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100 font-sans">
                    {model.quality.intelligence ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-sans">
                    {t('quality.coding', 'Coding')}
                  </span>
                  <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100 font-sans">
                    {model.quality.coding ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-sans">
                    {t('quality.agentic', 'Agentic')}
                  </span>
                  <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100 font-sans">
                    {model.quality.agentic ?? '—'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 font-sans">
                {t('drawer.source', 'Source')}: {model.quality.source}
              </p>
            </div>

            {/* Performance & Specifications */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 font-sans">
                {t('drawer.specs', 'Specifications & Speed')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 font-sans">
                <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-sans">
                    {t('columns.context', 'Context Window')}
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-sans">
                    {model.contextLength ? `${fmtTokens(model.contextLength)} tokens` : '—'}
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-sans">
                    {t('drawer.maxOutput', 'Max Output')}
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-sans">
                    {model.maxOutputTokens ? `${fmtTokens(model.maxOutputTokens)} tokens` : '—'}
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-sans">
                    {t('columns.speed', 'Speed')}
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-sans">
                    {model.speed?.outputTokensPerSecond
                      ? `${Math.round(model.speed.outputTokensPerSecond)} tok/s`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Offers Table */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 font-sans">
                {t('drawer.offers', 'Available Offers & Pricing')}
              </h3>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="p-2.5 font-semibold">{t('drawer.channel', 'Channel')}</th>
                      <th className="p-2.5 font-semibold">{t('drawer.vendor', 'Vendor')}</th>
                      <th className="p-2.5 font-semibold">{t('columns.input', 'Input /1M')}</th>
                      <th className="p-2.5 font-semibold">{t('columns.output', 'Output /1M')}</th>
                      <th className="p-2.5 font-semibold">{t('columns.cache', 'Cache Read')}</th>
                      <th className="p-2.5 font-semibold">
                        {t('drawer.longContext', 'Long Context')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                    {model.offers.map((o, idx) => (
                      <tr
                        key={idx}
                        className={
                          o === offer ? 'bg-indigo-50/50 dark:bg-indigo-950/30 font-medium' : ''
                        }
                      >
                        <td className="p-2.5">
                          <span className="capitalize">{o.channel}</span>
                          {o === offer && (
                            <span className="ml-1.5 text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-1 py-0.5 rounded">
                              {t('drawer.selected', 'Selected')}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5">{o.vendor}</td>
                        <td className="p-2.5">{fmtPerMTok(o.inputPerMTok)}</td>
                        <td className="p-2.5">{fmtPerMTok(o.outputPerMTok)}</td>
                        <td className="p-2.5">
                          {o.cacheReadPerMTok !== undefined ? fmtPerMTok(o.cacheReadPerMTok) : '—'}
                        </td>
                        <td className="p-2.5">
                          {o.longContext
                            ? `> ${fmtTokens(o.longContext.thresholdTokens)}: ${fmtPerMTok(o.longContext.inputPerMTok)} / ${fmtPerMTok(o.longContext.outputPerMTok)}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 p-6 flex flex-wrap items-center justify-between gap-4 bg-zinc-50 dark:bg-zinc-900 font-sans">
            <a
              href={`#/compare?items=m:${encodeURIComponent(model.id)}`}
              className="inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 border border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 px-3 py-1.5 text-sm rounded-md"
            >
              ➕ {t('drawer.addToCompare', 'Add to compare')}
            </a>
            <a
              href={`https://openrouter.ai/${model.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 px-3 py-1.5 text-sm rounded-md"
            >
              ↗ {t('drawer.viewOpenRouter', 'View on OpenRouter')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
