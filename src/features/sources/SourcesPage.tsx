import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAppData } from '../../data/AppData';
import { REPO_URL, newIssueUrl } from '../../app/config';
import type { SourceId, SourceStatus } from '../../domain/types';
import { isNeedsVerification } from './isNeedsVerification';

const KNOWN_SOURCES: {
  id: SourceId;
  url: string;
}[] = [
  { id: 'openrouter', url: 'https://openrouter.ai' },
  { id: 'litellm', url: 'https://github.com/BerriAI/litellm' },
  { id: 'artificial-analysis', url: 'https://artificialanalysis.ai' },
  { id: 'frankfurter', url: 'https://www.frankfurter.app' },
  { id: 'curated', url: 'https://github.com' },
];

export default function SourcesPage() {
  const { t, i18n } = useTranslation('sources');
  const { snapshot } = useAppData();
  const [unmatchedSearch, setUnmatchedSearch] = useState('');
  const [unmatchedSourceFilter, setUnmatchedSourceFilter] = useState<string>('all');

  const sourcesList = snapshot?.sources ?? [];
  const subscriptionsList = snapshot?.subscriptions ?? [];
  const channelFeesList = snapshot?.channelFees ?? [];
  const diagnostics = snapshot?.diagnostics;

  const globalReportUrl = newIssueUrl({
    template: 'outdated-data.yml',
    title: '[Outdated Data] General data update request',
    body: `Data Snapshot Date: ${snapshot?.generatedAt ?? 'Unknown'}\nRequested changes:\n`,
  });

  return (
    <div className="space-y-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* 1. Data Pipeline Sources Table */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {t('statusHeader')}
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="py-3 px-4">{t('table.source')}</th>
                <th className="py-3 px-4">{t('table.usage')}</th>
                <th className="py-3 px-4">{t('table.status')}</th>
                <th className="py-3 px-4">{t('table.itemCount')}</th>
                <th className="py-3 px-4">{t('table.fetchedAt')}</th>
                <th className="py-3 px-4">{t('table.license')}</th>
                <th className="py-3 px-4">{t('table.link')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {KNOWN_SOURCES.map((known) => {
                const srcStatus: SourceStatus | undefined = sourcesList.find(
                  (s) => s.id === known.id,
                );

                let badgeVariant: 'success' | 'warning' | 'danger' = 'danger';
                let badgeLabel = t('statusFailed');

                if (srcStatus?.ok) {
                  badgeVariant = 'success';
                  badgeLabel = t('statusOk');
                } else if (srcStatus?.skipped) {
                  badgeVariant = 'warning';
                  badgeLabel = t('statusSkipped');
                }

                const fetchedDate = srcStatus?.fetchedAt ? new Date(srcStatus.fetchedAt) : null;

                return (
                  <tr key={known.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      {t(`sources.${known.id}.name` as const, { defaultValue: known.id })}
                    </td>
                    <td className="py-3 px-4 max-w-xs text-xs">
                      {t(`sources.${known.id}.usage` as const, { defaultValue: '' })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                        {srcStatus?.error && (
                          <span
                            className="text-xs text-rose-500 cursor-help"
                            title={srcStatus.error}
                          >
                            ⚠️
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {srcStatus ? srcStatus.itemCount : '-'}
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      {fetchedDate ? (
                        <span title={fetchedDate.toISOString()}>
                          {fetchedDate.toLocaleDateString(i18n.language, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {t(`sources.${known.id}.license` as const, { defaultValue: '-' })}
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      <a
                        href={known.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium hover:underline inline-flex items-center gap-1"
                      >
                        {t('table.link')} ↗
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 2. Curated Data Freshness Section */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {t('curatedHeader')}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('curatedSubtitle')}</p>
          </div>
          {globalReportUrl && (
            <a
              href={globalReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors shrink-0"
            >
              {t('reportOutdatedData')} ↗
            </a>
          )}
        </div>

        {/* Subscription Plans Table */}
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-xs">
            {t('plansTable.title')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase">
                <tr>
                  <th className="py-2.5 px-3">{t('plansTable.provider')}</th>
                  <th className="py-2.5 px-3">{t('plansTable.plan')}</th>
                  <th className="py-2.5 px-3">{t('plansTable.price')}</th>
                  <th className="py-2.5 px-3">{t('plansTable.confidence')}</th>
                  <th className="py-2.5 px-3">{t('plansTable.lastVerified')}</th>
                  <th className="py-2.5 px-3">{t('plansTable.sources')}</th>
                  <th className="py-2.5 px-3 text-right">{t('plansTable.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {subscriptionsList.map((plan) => {
                  const needsVerif = isNeedsVerification(plan.lastVerified);
                  const reportUrl = newIssueUrl({
                    template: 'outdated-data.yml',
                    title: `[Outdated Data] Subscription plan: ${plan.id}`,
                    body: `Item Type: Subscription plan\nItem ID: ${plan.id}\nProvider: ${plan.providerName}\nPlan Name: ${plan.name}\nCurrent Price: $${plan.priceUsdMonthly}/mo\nLast Verified: ${plan.lastVerified}\n\nWhat is wrong / updated values:\n`,
                  });

                  let confVariant: 'success' | 'warning' | 'info' = 'info';
                  if (plan.confidence === 'official') confVariant = 'success';
                  else if (plan.confidence === 'reported') confVariant = 'warning';

                  return (
                    <tr key={plan.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {plan.providerName}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                        {plan.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs">${plan.priceUsdMonthly}/mo</td>
                      <td className="py-2.5 px-3">
                        <Badge variant={confVariant}>
                          {t(`confidence.${plan.confidence}` as const)}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{plan.lastVerified}</span>
                          {needsVerif && <Badge variant="warning">{t('needsVerification')}</Badge>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs">
                        <div className="flex flex-wrap gap-2">
                          {plan.sources.map((src, idx) => (
                            <a
                              key={idx}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                            >
                              {src.label} ↗
                            </a>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {reportUrl && (
                          <a
                            href={reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            {t('reportOutdatedData')}
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Channel Fees Table */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-xs">
            {t('feesTable.title')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase">
                <tr>
                  <th className="py-2.5 px-3">{t('feesTable.vendor')}</th>
                  <th className="py-2.5 px-3">{t('feesTable.feePct')}</th>
                  <th className="py-2.5 px-3">{t('feesTable.minFee')}</th>
                  <th className="py-2.5 px-3">{t('feesTable.minTopUp')}</th>
                  <th className="py-2.5 px-3">{t('feesTable.lastVerified')}</th>
                  <th className="py-2.5 px-3 text-right">{t('feesTable.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {channelFeesList.map((fee) => {
                  const needsVerif = isNeedsVerification(fee.lastVerified);
                  const reportUrl = newIssueUrl({
                    template: 'outdated-data.yml',
                    title: `[Outdated Data] Channel fee: ${fee.vendor}`,
                    body: `Item Type: Channel fee\nVendor: ${fee.vendor}\nPurchase Fee %: ${fee.purchaseFeePct}%\nMin Fee USD: $${fee.minFeeUsd}\nMin TopUp USD: $${fee.minTopUpUsd}\nLast Verified: ${fee.lastVerified}\n\nWhat is wrong / updated values:\n`,
                  });

                  return (
                    <tr key={fee.vendor} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                        {fee.vendor}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs">{fee.purchaseFeePct}%</td>
                      <td className="py-2.5 px-3 font-mono text-xs">${fee.minFeeUsd}</td>
                      <td className="py-2.5 px-3 font-mono text-xs">${fee.minTopUpUsd}</td>
                      <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{fee.lastVerified}</span>
                          {needsVerif && <Badge variant="warning">{t('needsVerification')}</Badge>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {reportUrl && (
                          <a
                            href={reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            {t('reportOutdatedData')}
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* 3. Methodology Section */}
      <Card>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {t('methodologyHeader')}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('methodologySubtitle')}</p>
        </div>

        <div className="space-y-4">
          {(
            [
              'costPerTask',
              'usageProfiles',
              'quality',
              'budgetReach',
              'subscriptions',
              'advisorScoring',
              'currencyVat',
              'disclaimer',
            ] as const
          ).map((sectionKey) => (
            <details
              key={sectionKey}
              className="group border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 transition-colors"
            >
              <summary className="flex items-center justify-between p-4 font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer select-none hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <span>{t(`methodology.${sectionKey}.title`)}</span>
                <span className="text-zinc-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="p-4 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-400 space-y-3">
                <p>{t(`methodology.${sectionKey}.p1`)}</p>
                <p>{t(`methodology.${sectionKey}.p2`)}</p>
                <p>{t(`methodology.${sectionKey}.p3`)}</p>
              </div>
            </details>
          ))}
        </div>
      </Card>

      {/* 4. Maintainer Diagnostics Section */}
      <Card>
        <details className="group">
          <summary className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer select-none">
            <div>
              <span className="text-base">{t('diagnosticsHeader')}</span>
              <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t('diagnosticsSubtitle')}
              </p>
            </div>
            <span className="text-zinc-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>

          <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-6 text-sm">
            {/* Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg font-mono text-xs">
              <div>
                <span className="text-zinc-500">{t('diagnostics.schemaVersion')}: </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {snapshot?.schemaVersion ?? '-'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">{t('diagnostics.generatedAt')}: </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {snapshot?.generatedAt ?? '-'}
                </span>
              </div>
            </div>

            {/* Unmatched Entity IDs */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {t('diagnostics.unmatchedTitle')}
                </h3>
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor="unmatched-source-filter">
                    {t('diagnostics.filterSource')}
                  </label>
                  <select
                    id="unmatched-source-filter"
                    value={unmatchedSourceFilter}
                    onChange={(e) => setUnmatchedSourceFilter(e.target.value)}
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    <option value="all">All sources</option>
                    {diagnostics?.unmatched.map((u) => (
                      <option key={u.source} value={u.source}>
                        {u.source} ({u.ids.length})
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor="unmatched-id-filter">
                    {t('diagnostics.filterIds')}
                  </label>
                  <input
                    id="unmatched-id-filter"
                    type="text"
                    value={unmatchedSearch}
                    onChange={(e) => setUnmatchedSearch(e.target.value)}
                    placeholder={t('diagnostics.filterPlaceholder')}
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  />
                </div>
              </div>

              {diagnostics?.unmatched && diagnostics.unmatched.length > 0 ? (
                <div className="space-y-3">
                  {diagnostics.unmatched
                    .filter(
                      (u) => unmatchedSourceFilter === 'all' || u.source === unmatchedSourceFilter,
                    )
                    .map((item) => {
                      const filteredIds = item.ids.filter((id) =>
                        id.toLowerCase().includes(unmatchedSearch.toLowerCase()),
                      );
                      if (filteredIds.length === 0) return null;

                      return (
                        <div
                          key={item.source}
                          className="border border-zinc-200 dark:border-zinc-800 rounded-md p-3"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                            <span>Source: {item.source}</span>
                            <Badge variant="warning">{filteredIds.length} IDs</Badge>
                          </div>
                          <div className="max-h-32 overflow-y-auto font-mono text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                            {filteredIds.map((id) => (
                              <div key={id} className="truncate">
                                • {id}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">No unmatched entity IDs.</p>
              )}
            </div>

            {/* Warnings */}
            <div className="space-y-2">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                {t('diagnostics.warningsTitle')} ({diagnostics?.warnings.length ?? 0})
              </h3>
              {diagnostics?.warnings && diagnostics.warnings.length > 0 ? (
                <ul className="list-disc list-inside text-xs text-amber-600 dark:text-amber-400 space-y-1 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
                  {diagnostics.warnings.map((warn, idx) => (
                    <li key={idx}>{warn}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500">{t('diagnostics.noWarnings')}</p>
              )}
            </div>

            {/* GitHub Documentation Links */}
            {REPO_URL && (
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {t('diagnostics.docsLinks')}
                </h3>
                <div className="flex flex-wrap gap-4 text-xs">
                  <a
                    href={`${REPO_URL.replace(/\/+$/, '')}/blob/main/docs/data-pipeline.md`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline inline-flex items-center gap-1"
                  >
                    {t('diagnostics.pipelineDoc')} ↗
                  </a>
                  <a
                    href={`${REPO_URL.replace(/\/+$/, '')}/blob/main/docs/curated-data.md`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline inline-flex items-center gap-1"
                  >
                    {t('diagnostics.curatedDoc')} ↗
                  </a>
                </div>
              </div>
            )}
          </div>
        </details>
      </Card>
    </div>
  );
}
