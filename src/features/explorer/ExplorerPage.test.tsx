import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../app/App';
import { queryClient } from '../../data/queryClient';
import builtSnapshot from '../../domain/__fixtures__/built-snapshot.json';
import i18n from '../../i18n';
import { useSettingsStore } from '../../state/settings';

const originalFetch = globalThis.fetch;

describe('ExplorerPage', () => {
  beforeEach(async () => {
    window.location.hash = '#/explorer?search=no-such-model';
    queryClient.clear();
    queryClient.setDefaultOptions({ queries: { retry: false } });
    useSettingsStore.getState().resetSettings();
    await i18n.changeLanguage('en');
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      if (String(url).includes('snapshot.json')) {
        return Promise.resolve(new Response(JSON.stringify(builtSnapshot), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('shows a no-match state and resets the URL-backed search', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'No matching models found' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Reset search' }));

    expect(screen.getByLabelText('Search models')).toHaveValue('');
    expect(window.location.hash).toBe('#/explorer');
  });
});
