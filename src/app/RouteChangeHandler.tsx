import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { routes } from './routes';

export function RouteChangeHandler() {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }

    const currentRoute = routes.find((r) => r.path === pathname);
    if (currentRoute) {
      const translatedTitle = t(`${currentRoute.ns}:title`);
      document.title = `${translatedTitle} · Token Price Analyzer`;
    } else if (pathname !== '/') {
      const notFoundTitle = t('common:notFound.title');
      document.title = `${notFoundTitle} · Token Price Analyzer`;
    }
  }, [pathname, t, i18n.language]);

  return null;
}
