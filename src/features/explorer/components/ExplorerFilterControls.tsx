import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProfileSelect } from '../../../components/ProfileSelect';
import { NumberInput, Select, Toggle, Button } from '../../../components/ui';
import { useSettingsStore } from '../../../state/settings';
import type { QualityTier } from '../../../domain/types';

export interface ExplorerFilterState {
  q: string;
  providers: string[];
  tier: QualityTier | 'any';
  maxPrice: number | undefined;
  caps: string[];
  pareto: boolean;
  hideNoQ: boolean;
}

export interface ExplorerFilterControlsProps {
  filters: ExplorerFilterState;
  onChangeFilters: (newFilters: Partial<ExplorerFilterState>) => void;
  onResetFilters: () => void;
  availableProviders: { id: string; name: string }[];
}

export function ExplorerFilterControls({
  filters,
  onChangeFilters,
  onResetFilters,
  availableProviders,
}: ExplorerFilterControlsProps) {
  const { t } = useTranslation('explorer');
  const currency = useSettingsStore((state) => state.currency);
  const includeFreeModels = useSettingsStore((state) => state.includeFreeModels);
  const setIncludeFreeModels = useSettingsStore((state) => state.setIncludeFreeModels);
  const includeBatchOffers = useSettingsStore((state) => state.includeBatchOffers);
  const setIncludeBatchOffers = useSettingsStore((state) => state.setIncludeBatchOffers);

  const [providerOpen, setProviderOpen] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setProviderOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleCapability = (cap: string) => {
    const next = filters.caps.includes(cap)
      ? filters.caps.filter((c) => c !== cap)
      : [...filters.caps, cap];
    onChangeFilters({ caps: next });
  };

  const toggleProvider = (pId: string) => {
    const next = filters.providers.includes(pId)
      ? filters.providers.filter((p) => p !== pId)
      : [...filters.providers, pId];
    onChangeFilters({ providers: next });
  };

  const selectAllProviders = () => {
    onChangeFilters({ providers: availableProviders.map((p) => p.id) });
  };

  const clearAllProviders = () => {
    onChangeFilters({ providers: [] });
  };

  const tierOptions = [
    { value: 'any', label: t('filters.tierAny', 'Any Tier') },
    { value: 'S', label: 'Tier S' },
    { value: 'A', label: 'Tier A' },
    { value: 'B', label: 'Tier B' },
    { value: 'C', label: 'Tier C' },
    { value: 'D', label: 'Tier D' },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4 font-sans">
      {/* Top Row: ProfileSelect + Settings Toggles */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <ProfileSelect />
          </div>
          <a
            href="#/profiles"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline pb-2"
          >
            {t('filters.editProfiles', 'Edit profiles')}
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Toggle
            label={t('filters.includeFree', 'Include free models')}
            checked={includeFreeModels}
            onChange={setIncludeFreeModels}
          />
          <Toggle
            label={t('filters.includeBatch', 'Include batch offers')}
            checked={includeBatchOffers}
            onChange={setIncludeBatchOffers}
          />
        </div>
      </div>

      {/* Middle Row: Search, Provider Dropdown, Tier Select, Max Price */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        {/* Search */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t('filters.search', 'Search models')}
          </label>
          <input
            type="text"
            value={filters.q}
            onChange={(e) => onChangeFilters({ q: e.target.value })}
            placeholder={t('filters.searchPlaceholder', 'Filter by name or provider...')}
            className="w-full px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>

        {/* Provider Multi-Select Popover */}
        <div className="relative" ref={providerRef}>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t('filters.provider', 'Provider')}
          </label>
          <button
            type="button"
            onClick={() => setProviderOpen(!providerOpen)}
            className="w-full text-left px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 flex justify-between items-center cursor-pointer"
          >
            <span className="truncate">
              {filters.providers.length === 0
                ? t('filters.allProviders', 'All providers')
                : t('filters.selectedProviders', '{{count}} selected', {
                    count: filters.providers.length,
                  })}
            </span>
            <span className="ml-2 text-xs">▼</span>
          </button>

          {providerOpen && (
            <div className="absolute left-0 mt-1 w-64 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-30 p-2 space-y-2 max-h-60 overflow-y-auto">
              <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-700 pb-2">
                <button
                  type="button"
                  onClick={selectAllProviders}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {t('filters.selectAll', 'Select all')}
                </button>
                <button
                  type="button"
                  onClick={clearAllProviders}
                  className="text-xs font-medium text-zinc-500 hover:underline cursor-pointer"
                >
                  {t('filters.clearAll', 'Clear')}
                </button>
              </div>
              <div className="space-y-1">
                {availableProviders.map((p) => {
                  const isChecked = filters.providers.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 p-1 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleProvider(p.id)}
                        className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Min Tier Select */}
        <div>
          <Select
            label={t('filters.minTier', 'Min Quality Tier')}
            value={filters.tier}
            onChange={(e) => onChangeFilters({ tier: e.target.value as QualityTier | 'any' })}
            options={tierOptions}
          />
        </div>

        {/* Max Effective Price Input */}
        <div>
          <NumberInput
            label={t('filters.maxPrice', 'Max Price /1M ({{currency}})', { currency })}
            value={filters.maxPrice ?? 0}
            onChange={(val) => onChangeFilters({ maxPrice: val > 0 ? val : undefined })}
            min={0}
            step={0.1}
            placeholder={t('filters.maxPricePlaceholder', 'No max')}
          />
        </div>
      </div>

      {/* Capabilities Chips */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-2">
          {t('filters.capabilities', 'Capabilities')}:
        </span>
        {[
          { id: 'tools', label: t('caps.tools', 'Tools') },
          { id: 'reasoning', label: t('caps.reasoning', 'Reasoning') },
          { id: 'imageInput', label: t('caps.imageInput', 'Vision') },
          { id: 'openWeights', label: t('caps.openWeights', 'Open Weights') },
        ].map((c) => {
          const active = filters.caps.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCapability(c.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border cursor-pointer ${
                active
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-800 dark:bg-indigo-900/60 dark:border-indigo-700 dark:text-indigo-200'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {active ? '✓ ' : '+ '}
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Bottom Toggles & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-4">
          <Toggle
            label={t('filters.paretoOnly', 'Only best deals (Pareto)')}
            checked={filters.pareto}
            onChange={(checked) => onChangeFilters({ pareto: checked })}
          />
          <Toggle
            label={t('filters.hideNoQ', 'Hide models without quality data')}
            checked={filters.hideNoQ}
            onChange={(checked) => onChangeFilters({ hideNoQ: checked })}
          />
        </div>

        <Button variant="ghost" size="sm" onClick={onResetFilters}>
          {t('filters.reset', 'Reset filters')}
        </Button>
      </div>
    </div>
  );
}
