import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../app/App';
import builtSnapshot from '../../domain/__fixtures__/built-snapshot.json';
import { queryClient } from '../../data/queryClient';
import i18n from '../../i18n';
import { useSettingsStore } from '../../state/settings';
import { isNeedsVerification } from './isNeedsVerification';
import * as configModule from '../../app/config';

const originalFetch = globalThis.fetch;

describe('SourcesPage', () => {
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

  async function navigateToSources(user: ReturnType<typeof userEvent.setup>) {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: 'Sources' })[0]).toBeInTheDocument();
    });
    const sourcesLink = screen.getAllByRole('link', { name: 'Sources' })[0]!;
    await user.click(sourcesLink);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Data Sources & Methodology' }),
      ).toBeInTheDocument();
    });
  }

  describe('isNeedsVerification helper', () => {
    it('returns true when lastVerified is older than 45 days', () => {
      const now = Date.parse('2025-03-01T00:00:00Z');
      expect(isNeedsVerification('2025-01-01', now)).toBe(true);
    });

    it('returns false when lastVerified is within 45 days', () => {
      const now = Date.parse('2025-03-01T00:00:00Z');
      expect(isNeedsVerification('2025-02-15', now)).toBe(false);
    });
  });

  it('renders source statuses from the snapshot fixture', async () => {
    const user = userEvent.setup();
    await navigateToSources(user);

    expect(screen.getAllByText('OpenRouter')[0]).toBeInTheDocument();
    expect(screen.getAllByText('LiteLLM')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Artificial Analysis')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Frankfurter (ECB)')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Curated Data')[0]).toBeInTheDocument();
  });

  it('displays needs verification warning for stale plans (>45 days)', async () => {
    const staleSnapshot = {
      ...builtSnapshot,
      subscriptions: [
        {
          ...builtSnapshot.subscriptions[0]!,
          lastVerified: '2020-01-01',
        },
        ...builtSnapshot.subscriptions.slice(1),
      ],
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('snapshot.json')) {
        return Promise.resolve(new Response(JSON.stringify(staleSnapshot), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    const user = userEvent.setup();
    await navigateToSources(user);

    const warnings = screen.getAllByText('Needs verification (>45 days)');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('hides report outdated button when REPO_URL is empty', async () => {
    const user = userEvent.setup();
    await navigateToSources(user);

    expect(screen.queryByText('Report outdated data')).not.toBeInTheDocument();
  });

  it('provides accessible names for diagnostic filters', async () => {
    const user = userEvent.setup();
    await navigateToSources(user);

    await user.click(screen.getByText('Maintainer Diagnostics'));

    expect(screen.getByRole('combobox', { name: 'Filter source' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search unmatched IDs' })).toBeInTheDocument();
  });

  it('renders report outdated data links with correct href when REPO_URL is set', async () => {
    const originalNewIssueUrl = configModule.newIssueUrl;
    vi.spyOn(configModule, 'newIssueUrl').mockImplementation((params) =>
      originalNewIssueUrl(params, 'https://github.com/example/token-price-analyzer'),
    );

    const user = userEvent.setup();
    await navigateToSources(user);

    const reportLinks = screen.getAllByRole('link', { name: /Report outdated data/i });
    expect(reportLinks.length).toBeGreaterThan(0);

    const firstHref = reportLinks[0]!.getAttribute('href');
    expect(firstHref).toContain('https://github.com/example/token-price-analyzer/issues/new?');
    expect(firstHref).toContain('template=outdated-data.yml');
  });
});
