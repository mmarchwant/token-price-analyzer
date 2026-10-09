import { describe, expect, it, beforeEach } from 'vitest';
import { useSettingsStore, getDefaultSettings } from './settings';
import type { UsageProfile } from '../domain/types';

describe('settings store', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings();
  });

  it('has initial default values', () => {
    const state = useSettingsStore.getState();
    expect(state.theme).toBe('system');
    expect(state.activeProfileId).toBe('chat-heavy');
    expect(state.budget).toEqual({ amount: 20, currency: 'USD' });
    expect(state.activeHoursPerDay).toBe(8);
    expect(state.vatRatePct).toBe(0);
    expect(state.includeFreeModels).toBe(true);
    expect(state.includeBatchOffers).toBe(false);
    expect(state.liveRefresh).toBe(true);
    expect(state.modelIntent).toBe('all');
  });

  it('updates state via setters', () => {
    const store = useSettingsStore.getState();
    store.setCurrency('EUR');
    store.setTheme('dark');
    store.setBudget({ amount: 50, currency: 'EUR' });
    store.setActiveHoursPerDay(10);
    store.setVatRatePct(23);
    store.setIncludeFreeModels(false);
    store.setIncludeBatchOffers(true);
    store.setLiveRefresh(false);
    store.setModelIntent('coding');

    const updated = useSettingsStore.getState();
    expect(updated.currency).toBe('EUR');
    expect(updated.theme).toBe('dark');
    expect(updated.budget).toEqual({ amount: 50, currency: 'EUR' });
    expect(updated.activeHoursPerDay).toBe(10);
    expect(updated.vatRatePct).toBe(23);
    expect(updated.includeFreeModels).toBe(false);
    expect(updated.includeBatchOffers).toBe(true);
    expect(updated.liveRefresh).toBe(false);
    expect(updated.modelIntent).toBe('coding');
  });

  it('upserts and deletes custom profiles', () => {
    const testProfile: UsageProfile = {
      id: 'custom-one',
      name: { en: 'Custom One', pl: 'Własny Jeden' },
      description: { en: 'Desc', pl: 'Opis' },
      inputTokensPerTask: 1000,
      outputTokensPerTask: 200,
      cachedInputShare: 0.2,
      tasksPerDay: 50,
      workDaysPerMonth: 20,
      qualityDimension: 'intelligence',
      allowBatch: false,
      isPreset: false,
    };

    useSettingsStore.getState().upsertCustomProfile(testProfile);
    expect(useSettingsStore.getState().customProfiles).toHaveLength(1);
    expect(useSettingsStore.getState().customProfiles[0]?.id).toBe('custom-one');

    // Update profile
    const updatedProfile: UsageProfile = {
      ...testProfile,
      name: { en: 'Custom One Updated', pl: 'Własny Jeden Zaktualizowany' },
    };
    useSettingsStore.getState().upsertCustomProfile(updatedProfile);
    expect(useSettingsStore.getState().customProfiles).toHaveLength(1);
    expect(useSettingsStore.getState().customProfiles[0]?.name.en).toBe('Custom One Updated');

    // Delete profile
    useSettingsStore.getState().setActiveProfileId('custom-one');
    useSettingsStore.getState().deleteCustomProfile('custom-one');
    expect(useSettingsStore.getState().customProfiles).toHaveLength(0);
    expect(useSettingsStore.getState().activeProfileId).toBe('chat-heavy');
  });

  it('resets settings to default', () => {
    useSettingsStore.getState().setCurrency('PLN');
    useSettingsStore.getState().setTheme('light');
    useSettingsStore.getState().resetSettings();

    const state = useSettingsStore.getState();
    expect(state.theme).toBe(getDefaultSettings().theme);
  });
});
