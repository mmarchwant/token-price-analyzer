import React from 'react';

const AdvisorPage = React.lazy(() => import('../features/advisor/AdvisorPage'));
const ExplorerPage = React.lazy(() => import('../features/explorer/ExplorerPage'));
const BudgetPage = React.lazy(() => import('../features/budget/BudgetPage'));
const SubscriptionsPage = React.lazy(() => import('../features/subscriptions/SubscriptionsPage'));
const ComparePage = React.lazy(() => import('../features/compare/ComparePage'));
const HistoryPage = React.lazy(() => import('../features/history/HistoryPage'));
const ProfilesPage = React.lazy(() => import('../features/profiles/ProfilesPage'));
const SourcesPage = React.lazy(() => import('../features/sources/SourcesPage'));
export const NotFoundPage = React.lazy(() => import('../features/not-found/NotFoundPage'));

export interface RouteConfig {
  path: string;
  navKey: string;
  ns: string;
  Component: React.ComponentType;
}

export const routes: RouteConfig[] = [
  {
    path: '/advisor',
    navKey: 'advisor',
    ns: 'advisor',
    Component: AdvisorPage,
  },
  {
    path: '/explorer',
    navKey: 'explorer',
    ns: 'explorer',
    Component: ExplorerPage,
  },
  {
    path: '/budget',
    navKey: 'budget',
    ns: 'budget',
    Component: BudgetPage,
  },
  {
    path: '/subscriptions',
    navKey: 'subscriptions',
    ns: 'subscriptions',
    Component: SubscriptionsPage,
  },
  {
    path: '/compare',
    navKey: 'compare',
    ns: 'compare',
    Component: ComparePage,
  },
  {
    path: '/history',
    navKey: 'history',
    ns: 'history',
    Component: HistoryPage,
  },
  {
    path: '/profiles',
    navKey: 'profiles',
    ns: 'profiles',
    Component: ProfilesPage,
  },
  {
    path: '/sources',
    navKey: 'sources',
    ns: 'sources',
    Component: SourcesPage,
  },
];
