import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../i18n';
import ProfilesPage from './ProfilesPage';
import { AppDataProvider, useAppData } from '../../data/AppData';
import { useSettingsStore } from '../../state/settings';
import { encodeProfile } from './profileShare';
import type { UsageProfile } from '../../domain/types';
import builtSnapshot from '../../domain/__fixtures__/built-snapshot.json';

const originalFetch = globalThis.fetch;

function TestAppShell({ children }: { children: React.ReactNode }) {
  const { status } = useAppData();
  if (status !== 'ready') {
    return <div>Loading...</div>;
  }
  return <>{children}</>;
}

function renderWithProviders(initialEntries = ['/profiles']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AppDataProvider>
        <TestAppShell>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route path="/profiles" element={<ProfilesPage />} />
            </Routes>
          </MemoryRouter>
        </TestAppShell>
      </AppDataProvider>
    </QueryClientProvider>,
  );
}

describe('ProfilesPage', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings();

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

  it('renders presets list and page headers', async () => {
    renderWithProviders();

    expect(await screen.findByRole('heading', { name: /usage profiles/i })).toBeInTheDocument();
    expect(screen.getByText(/heavy chat & writing/i)).toBeInTheDocument();
    expect(screen.getByText(/casual chat/i)).toBeInTheDocument();
  });

  it('duplicates a preset, edits it, and saves it under My profiles', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    // Click "Duplicate & edit" on Casual chat
    const duplicateButtons = await screen.findAllByRole('button', { name: /duplicate & edit/i });
    await user.click(duplicateButtons[0]!);

    // Check that "Casual chat (Copy)" appears under My profiles
    const copyTitle = await screen.findAllByText('Casual chat (Copy)');
    expect(copyTitle.length).toBeGreaterThan(0);

    // Edit the profile name
    const nameInput = screen.getByPlaceholderText(/e.g. my coding assistant/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'My Custom Assistant');

    // Click Save profile button
    const saveButton = screen.getByRole('button', { name: /save profile/i });
    await user.click(saveButton);

    // Verify it saved and appears under My profiles
    expect(await screen.findByText('My Custom Assistant')).toBeInTheDocument();

    const state = useSettingsStore.getState();
    expect(state.activeProfileId).toBe('custom-my-custom-assistant');
    expect(state.customProfiles.length).toBe(1);
    expect(state.customProfiles[0]?.id).toBe('custom-my-custom-assistant');
  });

  it('shows validation error for 0 output tokens', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    // Duplicate a preset to get an editable custom profile
    const duplicateButtons = await screen.findAllByRole('button', { name: /duplicate & edit/i });
    await user.click(duplicateButtons[0]!);

    // Find output tokens input and set to 0
    const outputTokensInput = screen.getByLabelText(/output tokens per task/i);
    await user.clear(outputTokensInput);
    await user.type(outputTokensInput, '0');
    fireEvent.blur(outputTokensInput);

    // Save profile
    const saveButton = screen.getByRole('button', { name: /save profile/i });
    await user.click(saveButton);

    // Verify validation error
    const errorMessage = await screen.findByText(/output tokens per task must be greater than 0/i);
    const invalidInput = screen.getByRole('spinbutton', { name: /output tokens per task/i });

    expect(invalidInput).toHaveAttribute('aria-invalid', 'true');
    expect(invalidInput).toHaveAttribute('aria-describedby', errorMessage.id);
  });

  it('associates profile editor labels with their controls', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(await screen.findByRole('textbox', { name: /profile name/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /input tokens per task/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /output tokens per task/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /cached input share/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /tasks per day/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /work days per month/i })).toBeInTheDocument();
    expect(
      screen.getByRole('radiogroup', { name: /target quality dimension/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /allow batch api offers/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show/i }));

    expect(screen.getByRole('textbox', { name: /typical prompt/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /typical response/i })).toBeInTheDocument();
  });

  it('imports profile via URL parameter', async () => {
    const user = userEvent.setup();

    const profileToImport: UsageProfile = {
      id: 'custom-imported-agent',
      name: { en: 'Imported Agent', pl: 'Zaimportowany Agent' },
      description: { en: 'Shared profile via link', pl: 'Udostępniony profil' },
      inputTokensPerTask: 50000,
      outputTokensPerTask: 3000,
      cachedInputShare: 0.8,
      tasksPerDay: 100,
      workDaysPerMonth: 22,
      qualityDimension: 'agentic',
      allowBatch: false,
      isPreset: false,
    };

    const encoded = encodeProfile(profileToImport);
    renderWithProviders([`/profiles?import=${encoded}`]);

    // Check for import banner heading
    expect(await screen.findByRole('heading', { name: /^import profile$/i })).toBeInTheDocument();
    expect(screen.getByText(/imported agent/i)).toBeInTheDocument();

    // Confirm import
    const confirmButton = screen.getByRole('button', { name: /^import profile$/i });
    await user.click(confirmButton);

    // Verify profile is saved and active
    await waitFor(() => {
      const state = useSettingsStore.getState();
      expect(state.activeProfileId).toBe('custom-imported-agent');
      expect(state.customProfiles.length).toBe(1);
      expect(state.customProfiles[0]?.id).toBe('custom-imported-agent');
    });
  });
});
