import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { routes } from './routes';

const APP_NAME = 'Token Price Analyzer';

export function RouteChangeHandler() {
  const { pathname, hash } = useLocation();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const currentRoute = routes.find((r) => r.path === pathname);
    if (currentRoute) {
      const translatedTitle = t(`${currentRoute.ns}:title`);
      document.title = `${translatedTitle} | ${APP_NAME}`;
    } else if (pathname !== '/') {
      const notFoundTitle = t('common:notFound.title');
      document.title = `${notFoundTitle} | ${APP_NAME}`;
    }
  }, [pathname, t, i18n.language]);

  useEffect(() => {
    // Let explicit in-page links retain their native scroll and focus behavior.
    if (hash) return;

    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }

    const focusRouteContent = () => {
      const main = document.querySelector<HTMLElement>('main');
      const heading = main?.querySelector<HTMLElement>('h1');
      const target = heading ?? main;

      if (!target) return;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };

    const timer = window.setTimeout(focusRouteContent, 0);
    return () => window.clearTimeout(timer);
  }, [pathname, hash]);

  return null;
}
