import React from 'react';
import { renderHook, waitFor, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { AppDataProvider, useAppData } from './AppData';
import { queryClient } from './queryClient';
import App from '../app/App';
import builtSnapshot from '../domain/__fixtures__/built-snapshot.json';
import openrouterRaw from '../../scripts/__fixtures__/openrouter-models.json';
import { useSettingsStore } from '../state/settings';

const originalFetch = globalThis.fetch;

describe('AppData integration', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings();
    queryClient.clear();
    queryClient.setDefaultOptions({
      queries: { retry: false },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function createWrapper() {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <AppDataProvider>{children}</AppDataProvider>
        </QueryClientProvider>
      );
    };
  }

  it('loads snapshot and merges live OpenRouter prices in ready state', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('snapshot.json')) {
        return Promise.resolve(new Response(JSON.stringify(builtSnapshot), { status: 200 }));
      }
      if (urlStr.includes('openrouter.ai')) {
        return Promise.resolve(new Response(JSON.stringify(openrouterRaw), { status: 200 }));
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    const { result } = renderHook(() => useAppData(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.snapshot).toBeDefined();
    expect(result.current.models.length).toBeGreaterThan(0);
    expect(result.current.subscriptions.length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(result.current.live.status).toBe('ok');
    });

    expect(typeof result.current.live.changedCount).toBe('number');
    expect(typeof result.current.live.newCount).toBe('number');
    expect(result.current.modelById.size).toBeGreaterThan(0);
    expect(result.current.planById.size).toBeGreaterThan(0);
  });

  it('remains ready when live OpenRouter fetch fails', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('snapshot.json')) {
        return Promise.resolve(new Response(JSON.stringify(builtSnapshot), { status: 200 }));
      }
      if (urlStr.includes('openrouter.ai')) {
        return Promise.resolve(new Response('OpenRouter offline', { status: 500 }));
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    const { result } = renderHook(() => useAppData(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.snapshot).toBeDefined();

    await waitFor(() => {
      expect(result.current.live.status).toBe('error');
    });

    // App status is still ready, fallback to snapshot models
    expect(result.current.status).toBe('ready');
    expect(result.current.models.length).toEqual(builtSnapshot.models.length);
  });

  it('renders error state when snapshot fetch fails', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('snapshot.json')) {
        return Promise.resolve(new Response('Snapshot error', { status: 500 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load snapshot/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /retry|spróbuj/i })).toBeInTheDocument();
  });
});
