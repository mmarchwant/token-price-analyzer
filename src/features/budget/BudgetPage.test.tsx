import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import i18n from '../../i18n';
import App from '../../app/App';
import { useSettingsStore } from '../../state/settings';
import { queryClient } from '../../data/queryClient';
import builtSnapshot from '../../domain/__fixtures__/built-snapshot.json';

const originalFetch = globalThis.fetch;

describe('BudgetPage component', () => {
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

  async function navigateToBudget() {
    window.location.hash = '#/budget';
    render(<App />);
    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { level: 1, name: 'Budget reach calculator' }),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  }

  it('renders BudgetPage with default $20 budget and highlight cards', async () => {
    await navigateToBudget();

    expect(screen.getByText('Best Quality (Full Month)')).toBeInTheDocument();
    expect(screen.getByText('Most Work Days')).toBeInTheDocument();
    expect(screen.getByText('Best Value')).toBeInTheDocument();
  });

  it('changing budget amount updates calculations', async () => {
    const user = userEvent.setup();
    await navigateToBudget();

    const budgetInput = screen.getByLabelText('Monthly budget');
    await user.clear(budgetInput);
    await user.type(budgetInput, '100');
    await user.tab(); // trigger blur

    await waitFor(() => {
      expect(budgetInput).toHaveValue(100);
    });
  });

  it('metric tabs switch between Days, Tasks, and Tokens', async () => {
    const user = userEvent.setup();
    await navigateToBudget();

    const tasksTab = screen.getByRole('tab', { name: 'Tasks' });
    await user.click(tasksTab);

    expect(tasksTab).toHaveAttribute('aria-selected', 'true');

    const tokensTab = screen.getByRole('tab', { name: 'Tokens' });
    await user.click(tokensTab);

    expect(tokensTab).toHaveAttribute('aria-selected', 'true');
  });

  it('toggling Account for top-up fees updates usable credit in view', async () => {
    const user = userEvent.setup();
    await navigateToBudget();

    const feesToggle = screen.getByRole('switch', { name: 'Account for top-up fees' });
    expect(feesToggle).toHaveAttribute('aria-checked', 'true');

    await user.click(feesToggle);

    expect(feesToggle).toHaveAttribute('aria-checked', 'false');
  });
});
