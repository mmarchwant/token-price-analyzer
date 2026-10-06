import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import i18n from '../i18n';
import App from './App';
import { useSettingsStore } from '../state/settings';
import { queryClient } from '../data/queryClient';
import builtSnapshot from '../domain/__fixtures__/built-snapshot.json';

const originalFetch = globalThis.fetch;

describe('App Shell', () => {
  beforeEach(async () => {
    window.location.hash = '#/';
    useSettingsStore.getState().resetSettings();
    queryClient.clear();
    queryClient.setDefaultOptions({
      queries: { retry: false },
    });
    await i18n.changeLanguage('en');

    globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('snapshot.json')) {
        return Promise.resolve(new Response(JSON.stringify(builtSnapshot), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders layout, navigation links, and default route placeholder', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Token Price Analyzer')).toBeInTheDocument();
    });

    // Skip to content link
    expect(screen.getByText('Skip to content')).toBeInTheDocument();

    // Nav links exist
    expect(screen.getByRole('link', { name: 'Advisor' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Budget' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Subscriptions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compare' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profiles' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sources' })).toBeInTheDocument();

    // Default route redirects to Advisor page
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'What should I buy this month?' }),
      ).toBeInTheDocument();
    });
  });

  it('navigates to Explorer page when clicking Explorer link', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Explorer' })).toBeInTheDocument();
    });

    const explorerLink = screen.getByRole('link', { name: 'Explorer' });
    await user.click(explorerLink);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Model Explorer' })).toBeInTheDocument();
    });
  });

  it('switches language to PL and updates navigation labels', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Language' })).toBeInTheDocument();
    });

    const langSelect = screen.getByRole('combobox', { name: 'Language' });
    await user.selectOptions(langSelect, 'pl');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Doradca' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Eksplorator' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Budżet' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Subskrypcje' })).toBeInTheDocument();
    });
  });
});
