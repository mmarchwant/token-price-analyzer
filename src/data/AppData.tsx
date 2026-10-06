import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useSnapshotQuery } from './snapshot';
import { useLiveOpenRouterQuery } from './liveOpenRouter';
import { mergeLiveModels } from '../domain/sources/live-merge';
import { useSettingsStore } from '../state/settings';
import type {
  ChannelFee,
  FxRates,
  ModelEntry,
  Snapshot,
  SubscriptionPlan,
  UsageProfile,
} from '../domain/types';

export interface AppData {
  status: 'loading' | 'error' | 'ready';
  error?: Error;
  retry: () => void;
  snapshot?: Snapshot;
  models: ModelEntry[];
  subscriptions: SubscriptionPlan[];
  profiles: UsageProfile[];
  fees: ChannelFee[];
  fx: FxRates;
  generatedAt?: string;
  live: {
    enabled: boolean;
    status: 'idle' | 'loading' | 'ok' | 'error';
    fetchedAt?: string;
    changedCount: number;
    newCount: number;
    newModelIds: Set<string>;
  };
  refreshLive: () => void;
  modelById: Map<string, ModelEntry>;
  planById: Map<string, SubscriptionPlan>;
}

const AppDataContext = createContext<AppData | null>(null);

const defaultFx: FxRates = {
  base: 'USD',
  date: new Date().toISOString().split('T')[0] ?? '',
  rates: { USD: 1, PLN: 4.0, EUR: 0.92 },
};

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const snapshotQuery = useSnapshotQuery();
  const liveRefresh = useSettingsStore((state) => state.liveRefresh);
  const customProfiles = useSettingsStore((state) => state.customProfiles);

  const isSnapshotReady = Boolean(snapshotQuery.data);
  const liveEnabled = liveRefresh && isSnapshotReady;

  const liveQuery = useLiveOpenRouterQuery(liveEnabled);

  const status: AppData['status'] = snapshotQuery.isLoading
    ? 'loading'
    : snapshotQuery.isError
      ? 'error'
      : 'ready';

  const snapshot = snapshotQuery.data;

  const liveStatus: AppData['live']['status'] = !liveRefresh
    ? 'idle'
    : liveQuery.isLoading
      ? 'loading'
      : liveQuery.isError
        ? 'error'
        : liveQuery.data
          ? 'ok'
          : 'idle';

  const mergeResult = useMemo(() => {
    if (!snapshot) {
      return {
        models: [],
        changedPriceIds: new Set<string>(),
        newModelIds: new Set<string>(),
      };
    }

    if (liveQuery.data?.models) {
      return mergeLiveModels(snapshot.models, liveQuery.data.models);
    }

    return {
      models: snapshot.models,
      changedPriceIds: new Set<string>(),
      newModelIds: new Set<string>(),
    };
  }, [snapshot, liveQuery.data]);

  const profiles = useMemo(() => {
    if (!snapshot) return [];
    const presets = snapshot.usageProfiles;
    const customMap = new Map(customProfiles.map((p) => [p.id, p]));
    const presetIds = new Set(presets.map((p) => p.id));

    const combined = presets.map((p) => customMap.get(p.id) ?? p);
    for (const custom of customProfiles) {
      if (!presetIds.has(custom.id)) {
        combined.push(custom);
      }
    }
    return combined;
  }, [snapshot, customProfiles]);

  const subscriptions = useMemo(() => snapshot?.subscriptions ?? [], [snapshot]);
  const fees = useMemo(() => snapshot?.channelFees ?? [], [snapshot]);
  const fx = useMemo(() => snapshot?.fx ?? defaultFx, [snapshot]);

  const modelById = useMemo(() => {
    const map = new Map<string, ModelEntry>();
    for (const model of mergeResult.models) {
      map.set(model.id, model);
    }
    return map;
  }, [mergeResult.models]);

  const planById = useMemo(() => {
    const map = new Map<string, SubscriptionPlan>();
    for (const plan of subscriptions) {
      map.set(plan.id, plan);
    }
    return map;
  }, [subscriptions]);

  const refetchSnapshot = snapshotQuery.refetch;
  const refetchLive = liveQuery.refetch;

  const retry = useCallback(() => {
    refetchSnapshot();
    if (liveEnabled) {
      refetchLive();
    }
  }, [refetchSnapshot, liveEnabled, refetchLive]);

  const refreshLive = useCallback(() => {
    refetchLive();
  }, [refetchLive]);

  const liveFetchedAt = liveQuery.dataUpdatedAt
    ? new Date(liveQuery.dataUpdatedAt).toISOString()
    : undefined;

  const value = useMemo<AppData>(
    () => ({
      status,
      error: snapshotQuery.error ?? undefined,
      retry,
      snapshot,
      models: mergeResult.models,
      subscriptions,
      profiles,
      fees,
      fx,
      generatedAt: snapshot?.generatedAt,
      live: {
        enabled: liveRefresh,
        status: liveStatus,
        fetchedAt: liveFetchedAt,
        changedCount: mergeResult.changedPriceIds.size,
        newCount: mergeResult.newModelIds.size,
        newModelIds: mergeResult.newModelIds,
      },
      refreshLive,
      modelById,
      planById,
    }),
    [
      status,
      snapshotQuery.error,
      retry,
      snapshot,
      mergeResult,
      subscriptions,
      profiles,
      fees,
      fx,
      liveRefresh,
      liveStatus,
      liveFetchedAt,
      refreshLive,
      modelById,
      planById,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}
