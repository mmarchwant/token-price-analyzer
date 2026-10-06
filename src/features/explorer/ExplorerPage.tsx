import { useTranslation } from 'react-i18next';
import { PageHeader, Card, CardContent } from '../../components/ui';
import { ShareButton } from '../../components/ShareButton';

export default function ExplorerPage() {
  const { t } = useTranslation('explorer');
  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} actions={<ShareButton />} />
      <Card>
        <CardContent>
          <p className="text-zinc-600 dark:text-zinc-400">{t('comingSoon')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
