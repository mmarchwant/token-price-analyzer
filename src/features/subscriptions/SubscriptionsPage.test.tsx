import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../app/App';
import builtSnapshot from '../../domain/__fixtures__/built-snapshot.json';
import { queryClient } from '../../data/queryClient';
import i18n from '../../i18n';
import { useSettingsStore } from '../../state/settings';

const originalFetch = globalThis.fetch;

// Mock ResizeObserver for Recharts
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('SubscriptionsPage component', () => {
  beforeEach(async () => {
    window.location.hash = '#/subscriptions';
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

  async function navigateToSubscriptions() {
    render(<App />);
    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { level: 1, name: 'Subscriptions vs API' }),
        ).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  }

  it('renders SubscriptionsPage with cards and demand bar', async () => {
    await navigateToSubscriptions();

    expect(screen.getByText(/Your demand:/i)).toBeInTheDocument();
    expect(screen.getByText('Claude Pro')).toBeInTheDocument();
    expect(screen.getByText('ChatGPT Plus')).toBeInTheDocument();
  });

  it('unknown-limit card shows the non-estimable state', async () => {
    await navigateToSubscriptions();

    expect(
      screen.getAllByText('Limits not published: capacity cannot be estimated')[0],
    ).toBeInTheDocument();
  });

  it('changing active hours updates window plan capacity', async () => {
    const user = userEvent.setup();
    await navigateToSubscriptions();

    const hoursInput = screen.getByLabelText('Active work hours / day');
    await user.clear(hoursInput);
    await user.type(hoursInput, '12');
    await user.tab();

    await waitFor(() => {
      expect(hoursInput).toHaveValue(12);
    });
  });

  it('selecting a plan updates the break-even chart and summary table', async () => {
    const user = userEvent.setup();
    await navigateToSubscriptions();

    const toggleSummaryBtn = screen.getByRole('button', { name: 'Show summary table' });
    await user.click(toggleSummaryBtn);

    expect(screen.getByText('Break-even Analysis Table')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
