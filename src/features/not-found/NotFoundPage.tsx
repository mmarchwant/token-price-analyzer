import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button, PageHeader, Card, CardContent } from '../../components/ui';

export default function NotFoundPage() {
  const { t } = useTranslation('common');
  return (
    <div>
      <PageHeader title={t('notFound.title')} subtitle={t('notFound.description')} />
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 gap-4">
          <p className="text-zinc-600 dark:text-zinc-400">{t('notFound.description')}</p>
          <Link to="/advisor">
            <Button variant="primary">{t('notFound.goHome')}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
