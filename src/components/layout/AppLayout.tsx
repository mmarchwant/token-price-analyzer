import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { routes } from '../../app/routes';
import { useSettingsStore } from '../../state/settings';
import { useApplyTheme } from '../../hooks/useApplyTheme';
import { DataStatus } from './DataStatus';
import { Toggle } from '../ui/Toggle';
import { NumberInput } from '../ui/NumberInput';
import type { Currency } from '../../domain/types';

export function TokenIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v12" />
      <path d="M15 9.5a2.5 2.5 0 0 0-5 0c0 1.5 2 2.5 3 3.5s2 2 2 3.5a2.5 2.5 0 0 1-5 0" />
    </svg>
  );
}

const PRESET_VAT_RATES = [0, 23, 19, 20];

export function AppLayout({ children }: { children: React.ReactNode }) {
  useApplyTheme();
  const { t, i18n } = useTranslation('common');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currency = useSettingsStore((state) => state.currency);
  const theme = useSettingsStore((state) => state.theme);
  const vatRatePct = useSettingsStore((state) => state.vatRatePct);
  const liveRefresh = useSettingsStore((state) => state.liveRefresh);

  const setCurrency = useSettingsStore((state) => state.setCurrency);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setVatRatePct = useSettingsStore((state) => state.setVatRatePct);
  const setLiveRefresh = useSettingsStore((state) => state.setLiveRefresh);

  const isCustomVat = !PRESET_VAT_RATES.includes(vatRatePct);

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    localStorage.setItem('tpa-lang', lang);
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrency(e.target.value as Currency);
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value as 'system' | 'light' | 'dark');
  };

  const handleVatSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      if (PRESET_VAT_RATES.includes(vatRatePct)) {
        setVatRatePct(15);
      }
    } else {
      setVatRatePct(Number(val));
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const currentLang = i18n.language?.startsWith('pl') ? 'pl' : 'en';

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Skip to Content */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-indigo-600 focus:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        {t('actions.skipToContent')}
      </a>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/advisor"
                className="flex items-center gap-2 font-bold text-lg text-indigo-600 dark:text-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md p-1"
              >
                <TokenIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline-block tracking-tight text-zinc-900 dark:text-zinc-50">
                  {t('appTitle')}
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {routes.map((route) => (
                <NavLink
                  key={route.path}
                  to={route.path}
                  className={({ isActive }) =>
                    `px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60'
                    }`
                  }
                  end
                >
                  {({ isActive }) => (
                    <span aria-current={isActive ? 'page' : undefined}>
                      {t(`nav.${route.navKey}`)}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Header Controls & Data Status */}
            <div className="flex items-center gap-2">
              <DataStatus variant="compact" className="hidden sm:flex" />

              {/* VAT Control */}
              <div className="hidden sm:flex items-center gap-1">
                <label htmlFor="header-vat-select" className="sr-only">
                  {t('settings.vat', 'VAT')}
                </label>
                <select
                  id="header-vat-select"
                  value={isCustomVat ? 'custom' : String(vatRatePct)}
                  onChange={handleVatSelectChange}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-800 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
                  aria-label={t('settings.vat', 'VAT')}
                >
                  <option value="0">VAT 0%</option>
                  <option value="23">VAT 23% (PL)</option>
                  <option value="19">VAT 19% (DE)</option>
                  <option value="20">VAT 20% (FR)</option>
                  <option value="custom">{t('settings.vatOptionCustom', 'Custom VAT')}</option>
                </select>
                {isCustomVat && (
                  <div className="w-16">
                    <NumberInput
                      value={vatRatePct}
                      onChange={(v) => setVatRatePct(Math.max(0, Math.min(100, v ?? 0)))}
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      className="text-xs py-0.5"
                    />
                  </div>
                )}
              </div>

              {/* Live Refresh Toggle */}
              <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <Toggle
                  checked={liveRefresh}
                  onChange={setLiveRefresh}
                  label={t('settings.liveRefresh', 'Live prices')}
                />
              </div>

              {/* Language Selector */}
              <div className="relative">
                <label htmlFor="header-lang-select" className="sr-only">
                  {t('settings.language')}
                </label>
                <select
                  id="header-lang-select"
                  value={currentLang}
                  onChange={handleLanguageChange}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-800 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
                  aria-label={t('settings.language')}
                >
                  <option value="en">EN</option>
                  <option value="pl">PL</option>
                </select>
              </div>

              {/* Currency Selector */}
              <div className="relative">
                <label htmlFor="header-currency-select" className="sr-only">
                  {t('settings.currency')}
                </label>
                <select
                  id="header-currency-select"
                  value={currency}
                  onChange={handleCurrencyChange}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-800 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
                  aria-label={t('settings.currency')}
                >
                  <option value="USD">USD</option>
                  <option value="PLN">PLN</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              {/* Theme Selector */}
              <div className="relative">
                <label htmlFor="header-theme-select" className="sr-only">
                  {t('settings.theme')}
                </label>
                <select
                  id="header-theme-select"
                  value={theme}
                  onChange={handleThemeChange}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-800 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
                  aria-label={t('settings.theme')}
                >
                  <option value="system">{t('settings.themeSystem')}</option>
                  <option value="light">{t('settings.themeLight')}</option>
                  <option value="dark">{t('settings.themeDark')}</option>
                </select>
              </div>

              {/* Mobile Menu Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
                aria-label={mobileMenuOpen ? t('settings.closeMenu') : t('settings.openMenu')}
                className="lg:hidden inline-flex items-center justify-center p-2 rounded-md text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Disclosure Panel */}
        {mobileMenuOpen && (
          <div
            id="mobile-menu"
            className="lg:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 pt-2 pb-4 space-y-3 shadow-lg"
          >
            <div className="space-y-1">
              {routes.map((route) => (
                <NavLink
                  key={route.path}
                  to={route.path}
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                        : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`
                  }
                  end
                >
                  {({ isActive }) => (
                    <span aria-current={isActive ? 'page' : undefined}>
                      {t(`nav.${route.navKey}`)}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
              <Toggle
                checked={liveRefresh}
                onChange={setLiveRefresh}
                label={t('settings.liveRefresh', 'Live prices')}
              />
              <DataStatus variant="compact" />
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main id="main" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 py-6 text-sm text-zinc-500 dark:text-zinc-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-4">
          <DataStatus variant="full" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <Link
              to="/sources"
              className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm"
            >
              {t('footer.sourcesLink')}
            </Link>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{t('footer.attribution')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
