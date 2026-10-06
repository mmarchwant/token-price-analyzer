import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { useTranslation } from 'react-i18next';
import { useAppData } from '../../data/AppData';

export default function AdvisorPage() {
  const { t } = useTranslation('advisor');
  const { models, subscriptions } = useAppData();

  const modelsText = t('modelsCount', { count: models.length });
  const plansText = t('plansCount', { count: subscriptions.length });

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Card aria-live="polite">
        <p className="text-zinc-600 dark:text-zinc-400 font-medium">
          {t('loadedSummary', { models: modelsText, plans: plansText })}
        </p>
      </Card>
    </div>
  );
}
