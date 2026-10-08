import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppData } from '../../data/AppData';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface DataStatusProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function DataStatus({ variant = 'full', className = '' }: DataStatusProps) {
  const { generatedAt, live, refreshLive } = useAppData();
  const { t } = useTranslation('common');

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const snapshotDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const isOutdated = Boolean(
    generatedAt && now - new Date(generatedAt).getTime() > 3 * 24 * 60 * 60 * 1000,
  );

  let relativeTime = '';
  if (live.fetchedAt) {
    const diffMs = now - new Date(live.fetchedAt).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) {
      relativeTime = t('dataStatus.justNow', 'just now');
    } else {
      relativeTime = t('dataStatus.minsAgo', {
        count: diffMins,
        defaultValue: `${diffMins} min ago`,
      });
    }
  }

  const liveAnnouncement =
    live.status === 'loading'
      ? t('dataStatus.liveLoading', 'Updating live prices...')
      : live.status === 'error'
        ? t('dataStatus.liveUnavailable', 'Live prices unavailable, using the snapshot')
        : live.status === 'ok'
          ? t('dataStatus.liveRefreshComplete', {
              changed: live.changedCount,
              newModels: live.newCount,
              defaultValue: `Live prices updated: ${live.changedCount} price changes and ${live.newCount} new models`,
            })
          : '';

  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 ${className}`}
      >
        {isOutdated && (
          <Badge
            variant="warning"
            title={t('dataStatus.snapshotOutdated', 'Snapshot outdated (> 3 days old)')}
          >
            {t('dataStatus.snapshotOutdatedShort', '! >3d')}
          </Badge>
        )}
        {live.enabled && live.status === 'ok' && (
          <span className="flex items-center gap-1.5" title={live.fetchedAt}>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{relativeTime}</span>
          </span>
        )}
        {live.enabled && live.status === 'loading' && (
          <span className="flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400">
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
            <span>{t('dataStatus.liveLoading', 'Updating live...')}</span>
          </span>
        )}
        {live.enabled && live.status === 'error' && (
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>{t('dataStatus.liveUnavailable', 'Snapshot only')}</span>
          </span>
        )}
        {live.enabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshLive}
            title={t('dataStatus.refreshLive', 'Refresh live prices')}
            aria-label={t('dataStatus.refreshLive', 'Refresh live prices')}
          >
            <svg
              className={`h-3.5 w-3.5 ${live.status === 'loading' ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span>
          {t('dataStatus.snapshotDate', {
            date: snapshotDate,
            defaultValue: `Data snapshot: ${snapshotDate}`,
          })}
        </span>
        {isOutdated && (
          <Badge variant="warning">
            {t('dataStatus.snapshotOutdated', 'Snapshot outdated (> 3 days old)')}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {live.enabled && (
          <span
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-relevant="text"
          >
            {liveAnnouncement}
          </span>
        )}
        {live.enabled ? (
          live.status === 'ok' ? (
            <span>
              {t('dataStatus.liveUpdated', {
                time: relativeTime,
                changed: live.changedCount,
                newModels: live.newCount,
                defaultValue: `Live prices: updated ${relativeTime} · ${live.changedCount} price changes · ${live.newCount} new models`,
              })}
            </span>
          ) : live.status === 'loading' ? (
            <span>{t('dataStatus.liveLoading', 'Updating live prices...')}</span>
          ) : (
            <span>
              {t('dataStatus.liveUnavailable', 'Live prices unavailable, using the snapshot')}
            </span>
          )
        ) : (
          <span>{t('dataStatus.liveDisabled', 'Live prices disabled')}</span>
        )}

        {live.enabled && (
          <Button variant="secondary" size="sm" onClick={refreshLive}>
            {t('dataStatus.refreshLive', 'Refresh live prices')}
          </Button>
        )}
      </div>
    </div>
  );
}
