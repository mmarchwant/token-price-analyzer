import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router';
import { routes, NotFoundPage } from './routes';
import { RouteChangeHandler } from './RouteChangeHandler';
import { AppLayout } from '../components/layout/AppLayout';
import { Skeleton } from '../components/ui/Skeleton';

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-2">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-5 w-96" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <RouteChangeHandler />
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
    </HashRouter>
  );
}
