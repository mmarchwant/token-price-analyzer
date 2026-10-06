import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import i18n from '../../i18n';
import App from '../../app/App';
import { useSettingsStore } from '../../state/settings';
import { queryClient } from '../../data/queryClient';
import builtSnapshot from '../../domain/__fixtures__/built-snapshot.json';

const originalFetch = globalThis.fetch;

describe('ComparePage component', () => {
  beforeEach(async () => {
    window.location.hash = '#/compare';
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

    window.location.hash = `#/compare?items=m:${firstModel.id},s:${firstPlan.id}`;
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Detailed Comparison Table')).toBeInTheDocument();
    });

    expect(screen.getByText(firstModel.name)).toBeInTheDocument();
    expect(screen.getByText(firstPlan.name)).toBeInTheDocument();
  });

  it('displays unknown items as Not found chips', async () => {
    window.location.hash = '#/compare?items=m:non-existent-model-id';
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Not found: non-existent-model-id')).toBeInTheDocument();
    });
  });

  it('adds an item via combobox search and removes a chip', async () => {
    const user = userEvent.setup();
    const firstModel = builtSnapshot.models[0];

    window.location.hash = '#/compare';
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Model Comparison' }),
      ).toBeInTheDocument();
    });

    const combobox = screen.getByRole('combobox', { name: /add model or subscription plan/i });
    await user.type(combobox, firstModel.name);

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: new RegExp(firstModel.name, 'i') }),
      ).toBeInTheDocument();
    });

    const option = screen.getByRole('option', { name: new RegExp(firstModel.name, 'i') });
    await user.click(option);

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
});
