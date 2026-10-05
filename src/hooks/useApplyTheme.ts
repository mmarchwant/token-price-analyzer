import { useEffect } from 'react';
import { useSettingsStore } from '../state/settings';

export function useApplyTheme(): void {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    const applyTheme = () => {
      let isDark: boolean;
      if (theme === 'dark') {
        isDark = true;
      } else if (theme === 'light') {
        isDark = false;
      } else {
        isDark =
          typeof window.matchMedia === 'function'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
            : false;
      }

      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    if (theme === 'system' && typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        if (e.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
        return () => mediaQuery.removeEventListener('change', listener);
      }
    }
  }, [theme]);
}
