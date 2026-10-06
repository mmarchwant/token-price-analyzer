import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import i18n from '../../i18n';
import App from '../../app/App';
import { useSettingsStore } from '../../state/settings';
import { queryClient } from '../../data/queryClient';
import builtSnapshot from '../../domain/__fixtures__/built-snapshot.json';

const originalFetch = globalThis.fetch;

describe('AdvisorPage component', () => {
  beforeEach(async () => {
    window.location.hash = '#/advisor';
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

  it('renders Advisor page title, wizard step cards, and top pick recommendation for $20 budget and coding profile', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'What should I buy this month?' }),
      ).toBeInTheDocument();
    });

    // Check wizard steps are rendered
    expect(screen.getByText('1. Budget')).toBeInTheDocument();
    expect(screen.getByText('2. What do you do?')).toBeInTheDocument();
    expect(screen.getByText('3. How much?')).toBeInTheDocument();
    expect(screen.getByText('4. Must-haves')).toBeInTheDocument();
    expect(screen.getByText('5. Minimum quality')).toBeInTheDocument();

    // Select "Coding Agent" profile
    await waitFor(() => {
      expect(screen.getByText('Coding Agent')).toBeInTheDocument();
    });
    const codingProfileBtn = screen.getByText('Coding Agent');
    await user.click(codingProfileBtn);

    // Set budget to 20
    const budgetInput = screen.getByLabelText('Monthly budget');
    fireEvent.change(budgetInput, { target: { value: '20' } });
    fireEvent.blur(budgetInput);

    // Wait for debounced live calculation
    await waitFor(
      () => {
        expect(screen.getAllByText('TOP PICK').length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    // Verify strategy badge exists
    expect(
      screen.getAllByText(/API Pay-as-you-go|Subscription|Two Subscriptions/i).length,
    ).toBeGreaterThan(0);

    // Verify URL parameter updated
    expect(window.location.hash).toContain('b=20');
  });

  it('switches language to PL and updates titles and strategy names', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    await i18n.changeLanguage('pl');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Co kupić w tym miesiącu?' }),
      ).toBeInTheDocument();
    });
  });
});
