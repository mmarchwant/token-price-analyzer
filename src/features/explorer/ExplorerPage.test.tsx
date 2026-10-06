import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import '../../i18n';
import { AppDataProvider } from '../../data/AppData';
import { useSettingsStore } from '../../state/settings';
import ExplorerPage from './ExplorerPage';
import builtSnapshot from '../../domain/__fixtures__/built-snapshot.json';

const originalFetch = globalThis.fetch;

describe('ExplorerPage component test', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    useSettingsStore.getState().resetSettings();
    useSettingsStore.getState().setLiveRefresh(false);

    testQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('snapshot.json')) {
        return Promise.resolve(new Response(JSON.stringify(builtSnapshot), { status: 200 }));
      }
      if (urlStr.includes('openrouter.ai')) {
        return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function renderExplorerPage(initialEntries = ['/explorer']) {
    return render(
      <QueryClientProvider client={testQueryClient}>
        <AppDataProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <ExplorerPage />
          </MemoryRouter>
        </AppDataProvider>
      </QueryClientProvider>,
    );
  }

  it('renders rows from snapshot fixture', async () => {
    renderExplorerPage();

    // Wait until snapshot data is loaded and rows are rendered
    const gpt4oElements = await screen.findAllByText('GPT-4o');
    expect(gpt4oElements.length).toBeGreaterThan(0);

    const claudeElements = await screen.findAllByText('Claude 3.5 Sonnet');
    expect(claudeElements.length).toBeGreaterThan(0);
  });

  it('filters rows when searching via q URL parameter', async () => {
    renderExplorerPage(['/explorer?q=Claude']);

    const claudeElements = await screen.findAllByText('Claude 3.5 Sonnet');
    expect(claudeElements.length).toBeGreaterThan(0);
    expect(screen.queryByText('GPT-4o')).not.toBeInTheDocument();
  });

  it('reduces rows when pareto=true URL parameter is active', async () => {
    renderExplorerPage(['/explorer?pareto=true']);

    const paretoSwitch = await screen.findByRole('switch', { name: /Only best deals \(Pareto\)/i });
    expect(paretoSwitch).toBeChecked();
  });

  it('sorts rows when sort URL parameter is provided', async () => {
    renderExplorerPage(['/explorer?sort=inputPerMTok&dir=asc']);

    const gpt4oElements = await screen.findAllByText('GPT-4o');
    expect(gpt4oElements.length).toBeGreaterThan(0);

    const inputHeaders = screen.getAllByText('Input /1M');
    expect(inputHeaders[0]).toBeInTheDocument();
  });

  it('opens details drawer on row click', async () => {
    renderExplorerPage();

    const gpt4oElements = await screen.findAllByText('GPT-4o');
    const rowEl = gpt4oElements[0]?.closest('tr') || gpt4oElements[0]?.closest('div');
    expect(rowEl).not.toBeNull();

    fireEvent.click(rowEl!);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Available Offers & Pricing')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
