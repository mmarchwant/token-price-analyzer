import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
} from '../../components/ui';
import { ShareButton } from '../../components/ShareButton';
import { CopyNameButton } from '../../components/ui/CopyNameButton';
import { useAppData } from '../../data/AppData';
import { useMoney } from '../../data/hooks';
import { filterModelsByIntent } from '../../domain/model-intent';
import { useSettingsStore } from '../../state/settings';
import { stringCodec, useUrlState } from '../../state/urlState';
import { filterExplorerModels } from './explorerModels';

const channelKeys = {
  openrouter: 'channels.openrouter',
  'openrouter-free': 'channels.openrouterFree',
  'openrouter-batch': 'channels.openrouterBatch',
  direct: 'channels.direct',
} as const;

export default function ExplorerPage() {
  const { t } = useTranslation(['explorer', 'common']);
  const { models, status, error, retry } = useAppData();
  const modelIntent = useSettingsStore((state) => state.modelIntent);
  const { fmtPerMTok } = useMoney();
  const [search, setSearch] = useUrlState('search', stringCodec, '');
  const matchingModels = useMemo(
    () => filterExplorerModels(filterModelsByIntent(models, modelIntent), search),
    [models, modelIntent, search],
  );
  const hasSearch = search.trim().length > 0;

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} actions={<ShareButton />} />
      <div className="mb-6 max-w-2xl">
        <label
          htmlFor="explorer-search"
          className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200"
        >
          {t('searchLabel')}
        </label>
        <input
          id="explorer-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{t('searchHelp')}</p>
      </div>

      {status === 'loading' && (
        <div
          className="flex items-center gap-2 py-8 text-sm text-zinc-600 dark:text-zinc-400"
          role="status"
        >
          <Spinner size="sm" />
          {t('loading')}
        </div>
      )}
      {status === 'error' && (
        <ErrorState
          title={t('errorTitle')}
          message={error?.message ?? t('errorMessage')}
          onRetry={retry}
        />
      )}
      {status === 'ready' && models.length === 0 && (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      )}
      {status === 'ready' && models.length > 0 && matchingModels.length === 0 && (
        <EmptyState
          title={t('noResultsTitle')}
          description={t('noResultsDescription', { search })}
          action={
            <Button type="button" variant="secondary" onClick={() => setSearch('')}>
              {t('resetSearch')}
            </Button>
          }
        />
      )}
      {status === 'ready' && matchingModels.length > 0 && (
        <>
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            {hasSearch
              ? t('resultCountFiltered', { count: matchingModels.length })
              : t('resultCount', { count: matchingModels.length })}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {matchingModels.map((model) => (
              <Card key={model.id}>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center gap-1">
                      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {model.name}
                      </h2>
                      <CopyNameButton
                        text={model.name}
                        ariaLabel={t('copyModelName', { name: model.name })}
                        copiedLabel={t('modelNameCopied')}
                      />
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{model.providerName}</p>
                    {model.description && (
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                        {model.description}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t('offersTitle', { count: model.offers.length })}
                    </h3>
                    {model.offers.map((offer) => (
                      <div
                        key={`${offer.channel}-${offer.vendor}-${offer.sourceId}`}
                        className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge variant={offer.isFree ? 'success' : 'info'}>
                            {offer.isFree ? t('free') : t(channelKeys[offer.channel])}
                          </Badge>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {offer.vendor}
                          </span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                              {t('inputPrice')}
                            </dt>
                            <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {fmtPerMTok(offer.inputPerMTok)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                              {t('outputPrice')}
                            </dt>
                            <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {fmtPerMTok(offer.outputPerMTok)}
                            </dd>
                          </div>
                        </dl>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {t('perMillionTokens')}
                        </p>
                        {offer.url && (
                          <a
                            className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                            href={offer.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('openOffer')}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
