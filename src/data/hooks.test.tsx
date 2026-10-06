import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { useMoney, useActiveProfile, useFeeFor } from './hooks';
import { useSettingsStore } from '../state/settings';
import { AppDataProvider } from './AppData';
import type { PriceOffer } from '../domain/types';

// Mock snapshot query
vi.mock('./snapshot', () => ({
  useSnapshotQuery: () => ({
    isLoading: false,
    isError: false,
    data: {
      schemaVersion: 1,
      generatedAt: '2025-01-01T00:00:00Z',
      sources: [],
      fx: {
        base: 'USD',
        date: '2025-01-01',
        rates: { USD: 1, PLN: 4.0, EUR: 0.9 },
      },
      models: [],
      subscriptions: [],
      usageProfiles: [
        {
          id: 'chat-heavy',
          name: { en: 'Chat Heavy', pl: 'Czat intensywny' },
          description: { en: 'Desc', pl: 'Opis' },
          inputTokensPerTask: 1000,
          outputTokensPerTask: 500,
          cachedInputShare: 0.2,
          tasksPerDay: 50,
          workDaysPerMonth: 20,
          qualityDimension: 'intelligence',
          allowBatch: false,
          isPreset: true,
        },
        {
          id: 'coding-light',
          name: { en: 'Coding Light', pl: 'Kodowanie lekkie' },
          description: { en: 'Desc', pl: 'Opis' },
          inputTokensPerTask: 2000,
          outputTokensPerTask: 1000,
          cachedInputShare: 0.5,
          tasksPerDay: 10,
          workDaysPerMonth: 20,
          qualityDimension: 'coding',
          allowBatch: false,
          isPreset: true,
        },
      ],
      channelFees: [
        {
          vendor: 'openrouter',
          purchaseFeePct: 0,
          minFeeUsd: 0,
          minTopUpUsd: 0,
          notes: { en: 'None', pl: 'Brak' },
          sourceUrl: 'https://openrouter.ai',
          lastVerified: '2025-01-01',
        },
        {
          vendor: 'openai',
          purchaseFeePct: 0,
          minFeeUsd: 0,
          minTopUpUsd: 0,
          notes: { en: 'Direct', pl: 'Bezpośrednio' },
          sourceUrl: 'https://openai.com',
          lastVerified: '2025-01-01',
        },
      ],
      diagnostics: { unmatched: [], warnings: [] },
    },
  }),
}));

vi.mock('./liveOpenRouter', () => ({
  useLiveOpenRouterQuery: () => ({
    isLoading: false,
    isError: false,
    data: undefined,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppDataProvider>{children}</AppDataProvider>
      </QueryClientProvider>
    );
  };
}

describe('hooks', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings();
  });

  describe('useMoney', () => {
    it('converts USD to PLN with 23% VAT correctly', () => {
      useSettingsStore.getState().setCurrency('PLN');
      useSettingsStore.getState().setVatRatePct(23);

      const { result } = renderHook(() => useMoney(), { wrapper: createWrapper() });

      expect(result.current.currency).toBe('PLN');
      expect(result.current.isVatApplied).toBe(true);

      // $10 USD * 4.0 PLN/USD = 40 PLN. With 23% VAT = 49.20 PLN.
      const formatted = result.current.fmt(10);
      expect(formatted).toMatch(/49[.,]20/);

      // toUsd(49.20, 'PLN') removes VAT (-> 40) and converts to USD (-> 10)
      const usdAmount = result.current.toUsd(49.2, 'PLN');
      expect(usdAmount).toBeCloseTo(10, 2);
    });
  });

  describe('useActiveProfile', () => {
    it('returns the matched profile for activeProfileId', () => {
      useSettingsStore.getState().setActiveProfileId('coding-light');

      const { result } = renderHook(() => useActiveProfile(), { wrapper: createWrapper() });

      expect(result.current.id).toBe('coding-light');
    });

    it('falls back to the first preset if activeProfileId does not match', () => {
      useSettingsStore.getState().setActiveProfileId('non-existent-profile');

      const { result } = renderHook(() => useActiveProfile(), { wrapper: createWrapper() });

      expect(result.current.id).toBe('chat-heavy');
      expect(result.current.isPreset).toBe(true);
    });
  });

  describe('useFeeFor', () => {
    it('returns openrouter fee for openrouter channels and vendor fee for direct channel', () => {
      const { result: openrouterResult } = renderHook(
        () =>
          useFeeFor({
            channel: 'openrouter-free',
            vendor: 'openrouter',
            sourceId: 'test',
            inputPerMTok: 0,
            outputPerMTok: 0,
            isFree: true,
          }),
        { wrapper: createWrapper() },
      );

      expect(openrouterResult.current?.vendor).toBe('openrouter');

      const directOffer: PriceOffer = {
        channel: 'direct',
        vendor: 'openai',
        sourceId: 'test',
        inputPerMTok: 1,
        outputPerMTok: 2,
        isFree: false,
      };

      const { result: directResult } = renderHook(() => useFeeFor(directOffer), {
        wrapper: createWrapper(),
      });

      expect(directResult.current?.vendor).toBe('openai');
    });
  });
});
