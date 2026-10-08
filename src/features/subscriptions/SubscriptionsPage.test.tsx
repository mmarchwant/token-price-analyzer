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

    expect(
      screen.getByText(
        'Select at least one plan from the cards above to render the break-even chart.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole('checkbox')[0]!);
    const toggleSummaryBtn = screen.getByRole('button', { name: 'Show summary table' });
    await user.click(toggleSummaryBtn);

    expect(screen.getByText('Break-even Analysis Table')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('keeps the existing three selections and explains the fourth-selection limit', async () => {
    const user = userEvent.setup();
    await navigateToSubscriptions();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(20);
    await user.click(checkboxes[0]!);
    await user.click(checkboxes[1]!);
    await user.click(checkboxes[2]!);
    await user.click(checkboxes[3]!);

    expect(checkboxes[0]!).toBeChecked();
    expect(checkboxes[1]!).toBeChecked();
    expect(checkboxes[2]!).toBeChecked();
    expect(checkboxes[3]!).not.toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent(
      'You can compare up to three plans at a time.',
    );
  });

  it('uses the active filters for the chart and lets the user recover from zero results', async () => {
    const user = userEvent.setup();
    await navigateToSubscriptions();

    const claudeCheckbox = screen.getByRole('checkbox', {
      name: 'Select Anthropic Claude Pro for chart',
    });
    await user.click(claudeCheckbox);
    expect(claudeCheckbox).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'OpenAI' }));
    expect(
      screen.getByText(
        'Select at least one plan from the cards above to render the break-even chart.',
      ),
    ).toBeInTheDocument();

    const maxPrice = screen.getByLabelText('Max price (USD)');
    await user.clear(maxPrice);
    await user.type(maxPrice, '1');
    await user.tab();

    expect(screen.getByText('No plans match these filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));

    await waitFor(() => {
      expect(screen.getByText('Claude Pro')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('checkbox', { name: 'Select Anthropic Claude Pro for chart' }),
    ).toBeChecked();
  });
});
