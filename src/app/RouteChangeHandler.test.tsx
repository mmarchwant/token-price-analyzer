import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, useLocation } from 'react-router';
import '../i18n';
import { RouteChangeHandler } from './RouteChangeHandler';

function RouteFocusFixture() {
  const { pathname } = useLocation();

  return (
    <>
      <RouteChangeHandler />
      <Link to="/explorer">Explorer</Link>
      <main>
        <h1>{pathname === '/explorer' ? 'Model Explorer' : 'Advisor'}</h1>
        <a id="details" href="#details">
          Details
        </a>
      </main>
    </>
  );
}

describe('RouteChangeHandler', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  it('focuses the new page heading after client-side navigation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/advisor']}>
        <RouteFocusFixture />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link', { name: 'Explorer' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Model Explorer' })).toHaveFocus(),
    );
  });

  it('does not move focus for an explicit hash target', async () => {
    render(
      <MemoryRouter initialEntries={['/advisor#details']}>
        <RouteFocusFixture />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Advisor' })).toBeInTheDocument(),
    );

    const heading = screen.getByRole('heading', { name: 'Advisor' });
    const main = screen.getByRole('main');
    expect(heading).not.toHaveAttribute('tabindex');
    expect(main).not.toHaveAttribute('tabindex');
  });
});
