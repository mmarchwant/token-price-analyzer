import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import i18n from '../i18n';
import App from './App';
import { useSettingsStore } from '../state/settings';
import { queryClient } from '../data/queryClient';
import builtSnapshot from '../domain/__fixtures__/built-snapshot.json';

const originalFetch = globalThis.fetch;

function getCompactDesktopNavigation() {
  const navigation = screen.getAllByRole('navigation', { name: 'Primary navigation' })[0];
  if (!navigation) throw new Error('Expected compact desktop navigation to be rendered');
  return navigation;
}

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
    const compactDesktopNavigation = getCompactDesktopNavigation();
    expect(
      within(compactDesktopNavigation).getByRole('link', { name: 'Advisor' }),
    ).toBeInTheDocument();
    expect(
      within(compactDesktopNavigation).getByRole('link', { name: 'Explorer' }),
    ).toBeInTheDocument();
    expect(
      within(compactDesktopNavigation).getByRole('link', { name: 'Budget' }),
    ).toBeInTheDocument();
    expect(
      within(compactDesktopNavigation).getByRole('link', { name: 'Subscriptions' }),
    ).toBeInTheDocument();
    expect(
      within(compactDesktopNavigation).getByRole('link', { name: 'Compare' }),
    ).toBeInTheDocument();
    expect(
      within(compactDesktopNavigation).getByRole('link', { name: 'History' }),
    ).toBeInTheDocument();
    expect(
      within(compactDesktopNavigation).getByRole('link', { name: 'Profiles' }),
    ).toBeInTheDocument();
    expect(
      within(compactDesktopNavigation).getByRole('link', { name: 'Sources' }),
    ).toBeInTheDocument();

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
      expect(
        within(getCompactDesktopNavigation()).getByRole('link', { name: 'Explorer' }),
      ).toBeInTheDocument();
    });

    const explorerLink = within(getCompactDesktopNavigation()).getByRole('link', {
      name: 'Explorer',
    });
    await user.click(explorerLink);

    await waitFor(() => {
      const heading = screen.getByRole('heading', { level: 1, name: 'Model Explorer' });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveFocus();
    });
  });

  it('switches language to PL and updates navigation labels', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open main menu' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Open main menu' }));
    const menu = screen.getByRole('region', { name: 'Main menu' });
    const langSelect = within(menu).getByRole('combobox', { name: 'Language' });
    await user.selectOptions(langSelect, 'pl');

    await waitFor(() => {
      expect(within(menu).getByRole('link', { name: 'Doradca' })).toBeInTheDocument();
      expect(within(menu).getByRole('link', { name: 'Eksplorator' })).toBeInTheDocument();
      expect(within(menu).getByRole('link', { name: 'Budżet' })).toBeInTheDocument();
      expect(within(menu).getByRole('link', { name: 'Subskrypcje' })).toBeInTheDocument();
    });
  });

  it('keeps navigation and all settings in an accessible disclosure below the desktop breakpoint', async () => {
    const user = userEvent.setup();
    render(<App />);

    const menuButton = await screen.findByRole('button', { name: 'Open main menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(menuButton);
    expect(menuButton).toHaveAccessibleName('Close main menu');
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    const menu = screen.getByRole('region', { name: 'Main menu' });
    expect(within(menu).getByRole('combobox', { name: 'Language' })).toBeInTheDocument();
    expect(within(menu).getByRole('combobox', { name: 'Currency' })).toBeInTheDocument();
    expect(within(menu).getByRole('combobox', { name: 'Theme' })).toBeInTheDocument();
    expect(within(menu).getByRole('combobox', { name: 'VAT' })).toBeInTheDocument();
    expect(within(menu).getByRole('switch', { name: 'Live prices' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Main menu' })).not.toBeInTheDocument();
  });
});
