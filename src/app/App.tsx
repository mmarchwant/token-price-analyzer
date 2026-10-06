import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../data/queryClient';
import { AppDataProvider, useAppData } from '../data/AppData';
import { routes, NotFoundPage } from './routes';
import { RouteChangeHandler } from './RouteChangeHandler';
import { AppLayout } from '../components/layout/AppLayout';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { useTranslation } from 'react-i18next';

function FullPageSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 p-6 max-w-7xl mx-auto gap-6">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="flex flex-col gap-6 p-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-2">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-5 w-96" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

function AppContent() {
  const { status, error, retry } = useAppData();
  const { t } = useTranslation('common');

  if (status === 'loading') {
    return <FullPageSkeleton />;
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <ErrorState
          title={t('actions.error', 'Error')}
          message={error?.message || t('errors.snapshotFailed', 'Failed to load dataset.')}
          onRetry={retry}
        />
      </div>
    );
  }

  return (
    <AppLayout>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Navigate to="/advisor" replace />} />
          {routes.map((route) => {
            const Component = route.Component;
            return <Route key={route.path} path={route.path} element={<Component />} />;
          })}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppDataProvider>
        <HashRouter>
          <RouteChangeHandler />
          <AppContent />
        </HashRouter>
      </AppDataProvider>
    </QueryClientProvider>
  );
}
