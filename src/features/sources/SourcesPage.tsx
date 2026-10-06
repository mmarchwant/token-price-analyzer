import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useTranslation } from 'react-i18next';
import { useAppData } from '../../data/AppData';

export default function SourcesPage() {
  const { t } = useTranslation('sources');
  const { snapshot } = useAppData();

  const sources = snapshot?.sources ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          {t('statusHeader')}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="py-3 px-4">{t('source')}</th>
                <th className="py-3 px-4">{t('status')}</th>
                <th className="py-3 px-4">{t('itemCount')}</th>
                <th className="py-3 px-4">{t('fetchedAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sources.map((src) => {
                let badgeVariant: 'success' | 'warning' | 'danger' = 'danger';
                let badgeLabel = t('statusFailed');

                if (src.ok) {
                  badgeVariant = 'success';
                  badgeLabel = t('statusOk');
                } else if (src.skipped) {
                  badgeVariant = 'warning';
                  badgeLabel = t('statusSkipped');
                }

                return (
                  <tr key={src.id}>
                    <td className="py-3 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {src.id}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                      {src.error && (
                        <p className="text-xs text-rose-500 dark:text-rose-400 mt-1">{src.error}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">{src.itemCount}</td>
                    <td className="py-3 px-4">{new Date(src.fetchedAt).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
