import { useTranslation } from 'react-i18next';
import { PageHeader, Card, CardContent } from '../../components/ui';

export default function SubscriptionsPage() {
  const { t } = useTranslation('subscriptions');
  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Card>
        <CardContent>
          <p className="text-zinc-600 dark:text-zinc-400">{t('comingSoon')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
