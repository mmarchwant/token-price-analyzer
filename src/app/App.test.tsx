import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../i18n';
import App from './App';
import { useSettingsStore } from '../state/settings';

describe('App Shell', () => {
  beforeEach(async () => {
    window.location.hash = '#/';
    useSettingsStore.getState().resetSettings();
    await i18n.changeLanguage('en');
  });

  it('renders layout, navigation links, and default route placeholder', async () => {
    render(<App />);

    // App header title
    expect(screen.getByText('Token Price Analyzer')).toBeInTheDocument();

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

    // Default route redirects to Advisor placeholder page
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'AI Advisor' })).toBeInTheDocument();
    });
  });

  it('navigates to Explorer page when clicking Explorer link', async () => {
    const user = userEvent.setup();
    render(<App />);

    const explorerLink = screen.getByRole('link', { name: 'Explorer' });
    await user.click(explorerLink);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Model Explorer' })).toBeInTheDocument();
    });
  });

  it('switches language to PL and updates navigation labels', async () => {
    const user = userEvent.setup();
    render(<App />);

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
