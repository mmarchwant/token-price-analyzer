import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, Tabs, Button, Skeleton, ErrorState } from '../../components/ui';
import { useAppData } from '../../data/AppData';
import { useActiveProfile, useMoney } from '../../data/hooks';
import { applyVat, convertFromUsd } from '../../domain/currency';
import { meetsMinTier } from '../../domain/quality';
import type { QualityTier } from '../../domain/types';
import { useSettingsStore } from '../../state/settings';
import {
  booleanCodec,
  buildShareUrl,
  enumCodec,
  listCodec,
  numberCodec,
  stringCodec,
  useUrlState,
  type Codec,
} from '../../state/urlState';
import { ExplorerDetailsDrawer } from './components/ExplorerDetailsDrawer';
import {
  ExplorerFilterControls,
  type ExplorerFilterState,
} from './components/ExplorerFilterControls';
import { ExplorerScatterMap } from './components/ExplorerScatterMap';
import { ExplorerTable } from './components/ExplorerTable';
import { buildExplorerRows, type ExplorerRow } from './explorerRows';

function ExplorerPageContent() {
  const { t, i18n } = useTranslation('explorer');
  const { models, live, fx } = useAppData();
  const activeProfile = useActiveProfile();
  const { currency } = useMoney();
  const vatRatePct = useSettingsStore((state) => state.vatRatePct);
  const includeFreeModels = useSettingsStore((state) => state.includeFreeModels);
  const includeBatchOffers = useSettingsStore((state) => state.includeBatchOffers);
  const budget = useSettingsStore((state) => state.budget);

  // Copy URL state
  const [copied, setCopied] = useState(false);

  // URL State Hooks
  const [q, setQ] = useUrlState('q', stringCodec, '');
  const [providers, setProviders] = useUrlState('providers', listCodec(stringCodec), []);
  const [tier, setTier] = useUrlState<QualityTier | 'any'>('tier', enumCodec(['any', 'S', 'A', 'B', 'C', 'D']), 'any');
  const [maxPrice, setMaxPrice] = useUrlState<number | undefined>(
    'maxPrice',
    numberCodec({ min: 0 }) as unknown as Codec<number | undefined>,
    undefined,
  );
  const [caps, setCaps] = useUrlState('caps', listCodec(stringCodec), []);
  const [pareto, setPareto] = useUrlState('pareto', booleanCodec, false);
  const [hideNoQ, setHideNoQ] = useUrlState('hideNoQ', booleanCodec, false);
  const [sort, setSort] = useUrlState('sort', stringCodec, 'value');
  const [dir, setDir] = useUrlState<'asc' | 'desc'>('dir', enumCodec(['asc', 'desc']), 'desc');
  const [view, setView] = useUrlState<'table' | 'map'>('view', enumCodec(['table', 'map']), 'table');
  const [page, setPage] = useUrlState('page', numberCodec({ min: 1 }), 1);

  // Selected row for Drawer
  const [selectedRow, setSelectedRow] = useState<ExplorerRow | null>(null);

  // Build all base rows
  const allRows = useMemo(() => {
    return buildExplorerRows(
      models,
      activeProfile,
      { includeFreeModels, includeBatchOffers },
      budget.amount,
      { newModelIds: live.newModelIds },
    );
  }, [models, activeProfile, includeFreeModels, includeBatchOffers, budget.amount, live.newModelIds]);

  // Available unique providers for multiselect
  const availableProviders = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRows) {
      map.set(r.model.provider, r.model.providerName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allRows]);

  // Filter & sort rows
  const filteredRows = useMemo(() => {
    let result = allRows;

    // Search query
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.model.name.toLowerCase().includes(term) ||
          r.model.providerName.toLowerCase().includes(term) ||
          r.model.provider.toLowerCase().includes(term) ||
          r.model.id.toLowerCase().includes(term),
      );
    }

    // Providers filter
    if (providers.length > 0) {
      result = result.filter(
        (r) => providers.includes(r.model.provider) || providers.includes(r.model.providerName),
      );
    }

    // Min Quality Tier
    if (tier !== 'any') {
      result = result.filter((r) => meetsMinTier(r.tier, tier as QualityTier));
    }

    // Max Effective Price
    if (maxPrice !== undefined && maxPrice > 0) {
      result = result.filter((r) => {
        const userPrice = applyVat(convertFromUsd(r.effectivePerMTok, currency, fx), vatRatePct);
        return userPrice <= maxPrice;
      });
    }

    // Capabilities
    if (caps.length > 0) {
      result = result.filter((r) => {
        if (caps.includes('tools') && !r.model.capabilities.tools) return false;
        if (caps.includes('reasoning') && !r.model.capabilities.reasoning) return false;
        if (caps.includes('imageInput') && !r.model.capabilities.imageInput) return false;
        if (caps.includes('openWeights') && r.openWeights !== true) return false;
        return true;
      });
    }

    // Pareto only
    if (pareto) {
      result = result.filter((r) => r.isPareto);
    }

    // Hide models without quality score
    if (hideNoQ) {
      result = result.filter((r) => r.quality !== undefined);
    }

    // Custom sorting
    return [...result].sort((a, b) => {
      let valA: number | string;
      let valB: number | string;

      switch (sort) {
        case 'model':
          valA = a.model.name;
          valB = b.model.name;
          break;
        case 'inputPerMTok':
          valA = a.inputPerMTok;
          valB = b.inputPerMTok;
          break;
        case 'outputPerMTok':
          valA = a.outputPerMTok;
          valB = b.outputPerMTok;
          break;
        case 'cacheReadPerMTok':
          valA = a.cacheReadPerMTok ?? Number.MAX_VALUE;
          valB = b.cacheReadPerMTok ?? Number.MAX_VALUE;
          break;
        case 'effectivePerMTok':
          valA = a.effectivePerMTok;
          valB = b.effectivePerMTok;
          break;
        case 'costPerTask':
          valA = a.costPerTask;
          valB = b.costPerTask;
          break;
        case 'monthlyCost':
          valA = a.monthlyCost;
          valB = b.monthlyCost;
          break;
        case 'quality':
          valA = a.quality ?? -1;
          valB = b.quality ?? -1;
          break;
        case 'contextLength':
          valA = a.contextLength ?? 0;
          valB = b.contextLength ?? 0;
          break;
        case 'speed':
          valA = a.speed?.outputTokensPerSecond ?? 0;
          valB = b.speed?.outputTokensPerSecond ?? 0;
          break;
        case 'value':
        default:
          valA = (a.isPareto ? 1000000 : 0) + (a.qualityPerDollar ?? 0);
          valB = (b.isPareto ? 1000000 : 0) + (b.qualityPerDollar ?? 0);
          break;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      const numA = Number(valA);
      const numB = Number(valB);
      return dir === 'asc' ? numA - numB : numB - numA;
    });
  }, [allRows, q, providers, tier, maxPrice, caps, pareto, hideNoQ, sort, dir, currency, fx, vatRatePct]);

  const handleCopyLink = async () => {
    try {
      const url = buildShareUrl();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleFilterChange = (newFilters: Partial<ExplorerFilterState>) => {
    if (newFilters.q !== undefined) setQ(newFilters.q);
    if (newFilters.providers !== undefined) setProviders(newFilters.providers);
    if (newFilters.tier !== undefined) setTier(newFilters.tier);
    if (newFilters.maxPrice !== undefined) setMaxPrice(newFilters.maxPrice);
    if (newFilters.caps !== undefined) setCaps(newFilters.caps);
    if (newFilters.pareto !== undefined) setPareto(newFilters.pareto);
    if (newFilters.hideNoQ !== undefined) setHideNoQ(newFilters.hideNoQ);
    setPage(1);
  };

  const handleResetFilters = () => {
    setQ('');
    setProviders([]);
    setTier('any');
    setMaxPrice(undefined);
    setCaps([]);
    setPareto(false);
    setHideNoQ(false);
    setPage(1);
  };

  const handleSortChange = (newSort: string, newDir: 'asc' | 'desc') => {
    setSort(newSort);
    setDir(newDir);
  };

  const lang = i18n.language?.startsWith('pl') ? 'pl' : 'en';
  const profileName = activeProfile.name[lang] || activeProfile.name.en;

  const vatInfo =
    vatRatePct > 0
      ? t('summary.vatApplied', ', incl. VAT {{pct}}%', { pct: vatRatePct })
      : '';

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <PageHeader
        title={t('title', 'Model Explorer')}
        subtitle={t('subtitle', 'Explore and compare model prices across providers and channels')}
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={handleCopyLink}>
              {copied ? t('copied', 'Copied!') : t('copyLink', 'Copy link')}
            </Button>

            <Tabs
              tabs={[
                { id: 'table', label: t('views.table', 'Table') },
                { id: 'map', label: t('views.map', 'Cost–quality map') },
              ]}
              activeTab={view}
              onChange={(tabId) => setView(tabId as 'table' | 'map')}
            />
          </div>
        }
      />

      {/* Filter Controls Bar */}
      <ExplorerFilterControls
        filters={{ q, providers, tier, maxPrice, caps, pareto, hideNoQ }}
        onChangeFilters={handleFilterChange}
        onResetFilters={handleResetFilters}
        availableProviders={availableProviders}
      />

      {/* Summary line */}
      <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 px-1">
        {t('summary.count', {
          count: filteredRows.length,
          total: allRows.length,
        })}{' '}
        · {t('summary.profile', { name: profileName })} ·{' '}
        {t('summary.pricesIn', { currency })}
        {vatInfo}
      </div>

      {/* Main View: Table vs Scatter Map */}
      {view === 'table' ? (
        <ExplorerTable
          rows={filteredRows}
          activeProfile={activeProfile}
          sort={sort}
          dir={dir}
          onSortChange={handleSortChange}
          page={page}
          onPageChange={setPage}
          onSelectRow={setSelectedRow}
        />
      ) : (
        <ExplorerScatterMap rows={filteredRows} onSelectRow={setSelectedRow} />
      )}

      {/* Details Drawer */}
      <ExplorerDetailsDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
    </div>
  );
}

export default function ExplorerPage() {
  const { t } = useTranslation('explorer');
  const appData = useAppData();

  if (appData.status === 'loading') {
    return (
      <div className="space-y-6 font-sans">
        <PageHeader
          title={t('title', 'Model Explorer')}
          subtitle={t('subtitle', 'Explore and compare model prices across providers and channels')}
        />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (appData.status === 'error') {
    return (
      <div className="space-y-6 font-sans">
        <PageHeader
          title={t('title', 'Model Explorer')}
          subtitle={t('subtitle', 'Explore and compare model prices across providers and channels')}
        />
        <ErrorState
          message={appData.error?.message || t('error', 'Failed to load model snapshot data.')}
          onRetry={appData.retry}
        />
      </div>
    );
  }

  return <ExplorerPageContent />;
}
