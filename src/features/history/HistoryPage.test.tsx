import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import HistoryPage from './HistoryPage';

const originalFetch = globalThis.fetch;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HistoryPage />
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Server Error',
    json: async () => body,
  } as Response;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('HistoryPage', () => {
  it('loads a year and switches between model and subscription price history', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      if (String(url).endsWith('/data/history/index.json')) {
        return Promise.resolve(
          jsonResponse({
            schemaVersion: 1,
            years: [2025, 2026],
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        );
      }
      if (String(url).endsWith('/data/history/2026.json')) {
        return Promise.resolve(
          jsonResponse({
            schemaVersion: 1,
            year: 2026,
            updatedAt: '2026-01-01T00:00:00.000Z',
            models: {
              'acme/model': {
                firstSeen: '2026-01-01',
                points: [
                  ['2026-01-01', 2, 4],
                  ['2026-02-01', 1, 2],
                ],
              },
            },
            subscriptions: {
              pro: {
                firstSeen: '2026-01-01',
                points: [
                  ['2026-01-01', 20],
                  ['2026-02-01', 25],
                ],
              },
            },
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderPage();

    expect(await screen.findByRole('option', { name: 'acme/model' })).toBeInTheDocument();
    expect(screen.getByText('-50.0%')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'subscriptions' } });

    expect(await screen.findByRole('option', { name: 'pro' })).toBeInTheDocument();
    expect(screen.getByText('+25.0%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Price history chart for pro' })).toBeInTheDocument();
  });

  it('shows an actionable error when the index cannot be loaded', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Price history index could not be loaded.',
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
  });
});
