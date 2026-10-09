import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import '../../i18n';
import { useSettingsStore } from '../../state/settings';
import { AppLayout } from './AppLayout';

vi.mock('./DataStatus', () => ({
  DataStatus: () => null,
}));

describe('AppLayout mobile menu focus', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings();
  });

  it('focuses the first menu link when opened and restores the trigger when closed', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppLayout>
          <h1>Page title</h1>
        </AppLayout>
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: 'Open main menu' });
    await user.click(trigger);

    const menu = screen.getByRole('region', { name: 'Main menu' });
    expect(within(menu).getByRole('link', { name: 'Advisor' })).toHaveFocus();

    await user.click(trigger);

    expect(screen.queryByRole('region', { name: 'Main menu' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('restores the trigger after Escape and after selecting a mobile navigation link', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/explorer']}>
        <AppLayout>
          <h1>Page title</h1>
        </AppLayout>
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: 'Open main menu' });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(trigger).toHaveFocus();

    await user.click(trigger);
    const menu = screen.getByRole('region', { name: 'Main menu' });
    await user.click(within(menu).getByRole('link', { name: 'Advisor' }));

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('updates the global model intent from the settings control', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppLayout>
          <h1>Page title</h1>
        </AppLayout>
      </MemoryRouter>,
    );

    const intentSelect = screen.getAllByLabelText('Show models for')[0]!;
    await user.selectOptions(intentSelect, 'coding');

    expect(useSettingsStore.getState().modelIntent).toBe('coding');
  });
});
