import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import type { Currency, ModelIntent, UsageProfile } from '../domain/types';

export interface SettingsValue {
  currency: Currency;
  theme: 'system' | 'light' | 'dark';
  activeProfileId: string;
  customProfiles: UsageProfile[];
  budget: { amount: number; currency: Currency };
  activeHoursPerDay: number;
  vatRatePct: number;
  includeFreeModels: boolean;
  includeBatchOffers: boolean;
  liveRefresh: boolean;
  modelIntent: ModelIntent;
}

export interface SettingsState extends SettingsValue {
  setCurrency: (currency: Currency) => void;
  setTheme: (theme: 'system' | 'light' | 'dark') => void;
  setActiveProfileId: (id: string) => void;
  setCustomProfiles: (profiles: UsageProfile[]) => void;
  setBudget: (budget: { amount: number; currency: Currency }) => void;
  setActiveHoursPerDay: (hours: number) => void;
  setVatRatePct: (rate: number) => void;
  setIncludeFreeModels: (include: boolean) => void;
  setIncludeBatchOffers: (include: boolean) => void;
  setLiveRefresh: (refresh: boolean) => void;
  setModelIntent: (intent: ModelIntent) => void;

  upsertCustomProfile: (profile: UsageProfile) => void;
  deleteCustomProfile: (id: string) => void;
  resetSettings: () => void;
}

const safeLocalStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem(name) : null;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(name, value);
      }
    } catch {
      // ignore
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(name);
      }
    } catch {
      // ignore
    }
  },
};

export function getDefaultCurrency(): Currency {
  if (typeof window !== 'undefined') {
    const savedLang = localStorage.getItem('tpa-lang');
    if (savedLang && savedLang.startsWith('pl')) {
      return 'PLN';
    }
    if (navigator.language && navigator.language.toLowerCase().startsWith('pl')) {
      return 'PLN';
    }
  }
  return 'USD';
}

export function getDefaultSettings(): SettingsValue {
  return {
    currency: getDefaultCurrency(),
    theme: 'system',
    activeProfileId: 'chat-heavy',
    customProfiles: [],
    budget: { amount: 20, currency: 'USD' },
    activeHoursPerDay: 8,
    vatRatePct: 0,
    includeFreeModels: true,
    includeBatchOffers: false,
    liveRefresh: true,
    modelIntent: 'all',
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...getDefaultSettings(),

      setCurrency: (currency) => set({ currency }),
      setTheme: (theme) => set({ theme }),
      setActiveProfileId: (activeProfileId) => set({ activeProfileId }),
      setCustomProfiles: (customProfiles) => set({ customProfiles }),
      setBudget: (budget) => set({ budget }),
      setActiveHoursPerDay: (activeHoursPerDay) => set({ activeHoursPerDay }),
      setVatRatePct: (vatRatePct) => set({ vatRatePct }),
      setIncludeFreeModels: (includeFreeModels) => set({ includeFreeModels }),
      setIncludeBatchOffers: (includeBatchOffers) => set({ includeBatchOffers }),
      setLiveRefresh: (liveRefresh) => set({ liveRefresh }),
      setModelIntent: (modelIntent) => set({ modelIntent }),

      upsertCustomProfile: (profile) =>
        set((state) => {
          const exists = state.customProfiles.some((p) => p.id === profile.id);
          const updated = exists
            ? state.customProfiles.map((p) => (p.id === profile.id ? profile : p))
            : [...state.customProfiles, profile];
          return { customProfiles: updated };
        }),

      deleteCustomProfile: (id) =>
        set((state) => ({
          customProfiles: state.customProfiles.filter((p) => p.id !== id),
          activeProfileId: state.activeProfileId === id ? 'chat-heavy' : state.activeProfileId,
        })),

      resetSettings: () => set(getDefaultSettings()),
    }),
    {
      name: 'tpa-settings',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      migrate: (persistedState: unknown, version: number) => {
        if (version !== 1 || !persistedState || typeof persistedState !== 'object') {
          return getDefaultSettings();
        }
        return {
          ...getDefaultSettings(),
          ...(persistedState as Partial<SettingsValue>),
        };
      },
    },
  ),
);
