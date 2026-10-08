import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import i18n from '../../i18n';
import App from '../../app/App';
import { useSettingsStore } from '../../state/settings';
import { queryClient } from '../../data/queryClient';
import builtSnapshot from '../../domain/__fixtures__/built-snapshot.json';
import { clearStoredCompareRefs } from './compareItems';

const originalFetch = globalThis.fetch;

describe('ComparePage component', () => {
  beforeEach(async () => {
    window.location.hash = '#/compare';
    clearStoredCompareRefs();
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

  it('renders popular suggestions when no items are selected', async () => {
    window.location.hash = '#/compare';
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('No items selected for comparison')).toBeInTheDocument();
    });

    expect(screen.getByText('Popular options to start with:')).toBeInTheDocument();
  });

  it('renders two columns when opening #/compare?items=m:<id>,s:<id>', async () => {
    const firstModel = builtSnapshot.models[0];
    const firstPlan = builtSnapshot.subscriptions[0];
    if (!firstModel || !firstPlan) {
      throw new Error('Fixture missing model or plan');
    }

    window.location.hash = `#/compare?items=m:${firstModel.id},s:${firstPlan.id}`;
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Detailed Comparison Table')).toBeInTheDocument();
    });

    expect(screen.getAllByText(firstModel.name)).toHaveLength(2);
    expect(screen.getAllByText(firstPlan.name)).toHaveLength(2);
  });

  it('renders each selected item as a readable metric list below the desktop breakpoint', async () => {
    const firstModel = builtSnapshot.models[0];
    const firstPlan = builtSnapshot.subscriptions[0];
    if (!firstModel || !firstPlan) {
      throw new Error('Fixture missing comparison items');
    }

    window.location.hash = `#/compare?items=m:${firstModel.id},s:${firstPlan.id}`;
    render(<App />);

    const mobileComparison = await screen.findByRole('region', {
      name: 'Comparison details',
    });
    expect(
      within(mobileComparison).getByRole('heading', { name: firstModel.name }),
    ).toBeInTheDocument();
    expect(
      within(mobileComparison).getByRole('heading', { name: firstPlan.name }),
    ).toBeInTheDocument();
    const modelCard = within(mobileComparison)
      .getByRole('heading', { name: firstModel.name })
      .closest('article');
    expect(modelCard).not.toBeNull();
    expect(within(modelCard as HTMLElement).getByText('List Price')).toBeInTheDocument();
    expect(
      within(mobileComparison).getByRole('button', { name: `Remove ${firstModel.name}` }),
    ).toBeInTheDocument();

    const desktopTable = screen.getByRole('table');
    expect(desktopTable.parentElement).toHaveClass('hidden', 'lg:block');
  });

  it('displays unknown items as Not found chips', async () => {
    window.location.hash = '#/compare?items=m:non-existent-model-id';
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Not found: non-existent-model-id')).toBeInTheDocument();
    });
  });

  it('exposes the highlighted option and adds it with the keyboard', async () => {
    const user = userEvent.setup();
    const firstModel = builtSnapshot.models[0];
    if (!firstModel) {
      throw new Error('Fixture missing model');
    }

    window.location.hash = '#/compare';
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Model Comparison' }),
      ).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox', { name: /add model or subscription plan/i });
    await user.type(combobox, firstModel.providerName);

    await waitFor(() => {
      expect(within(screen.getByRole('listbox')).getAllByRole('option').length).toBeGreaterThan(1);
    });

    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    const option = options[0]!;
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    expect(combobox).toHaveAttribute('aria-controls', 'compare-picker-listbox');
    expect(option).toHaveAttribute('id');
    expect(combobox).toHaveAttribute('aria-activedescendant', option.id);

    await user.keyboard('{ArrowDown}');
    expect(combobox).toHaveAttribute('aria-activedescendant', options[1]!.id);
    await user.keyboard('{ArrowUp}');
    expect(combobox).toHaveAttribute('aria-activedescendant', option.id);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Detailed Comparison Table')).toBeInTheDocument();
    });

    // Remove the item chip
    const removeBtn = screen.getAllByRole('button', { name: `Remove ${firstModel.name}` })[0];
    expect(removeBtn).toBeDefined();
    await user.click(removeBtn!);

    await waitFor(() => {
      expect(screen.getByText('No items selected for comparison')).toBeInTheDocument();
    });
  });

  it('shows localized feedback for a query with no eligible results', async () => {
    const user = userEvent.setup();
    render(<App />);

    const combobox = await screen.findByRole('combobox', {
      name: /add model or subscription plan/i,
    });
    await user.type(combobox, 'no-match-expected');

    expect(await screen.findByText('No eligible models or plans found.')).toBeInTheDocument();
    expect(combobox).not.toHaveAttribute('aria-activedescendant');

    await user.keyboard('{Escape}');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).not.toHaveAttribute('aria-controls');
  });
});
