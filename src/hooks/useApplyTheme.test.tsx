import { renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useApplyTheme } from './useApplyTheme';
import { useSettingsStore } from '../state/settings';

describe('useApplyTheme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    useSettingsStore.getState().resetSettings();
  });

  it('applies dark class when theme is dark', () => {
    useSettingsStore.getState().setTheme('dark');
    renderHook(() => useApplyTheme());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class when theme is light', () => {
    document.documentElement.classList.add('dark');
    useSettingsStore.getState().setTheme('light');
    renderHook(() => useApplyTheme());
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
