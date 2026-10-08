import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataStatus } from './DataStatus';

const mockUseAppData = vi.hoisted(() => vi.fn());

vi.mock('../../data/AppData', () => ({
  useAppData: mockUseAppData,
}));

describe('DataStatus', () => {
  beforeEach(() => {
    mockUseAppData.mockReturnValue({
      generatedAt: '2026-10-08T00:00:00.000Z',
      live: {
        enabled: true,
        status: 'loading',
        changedCount: 0,
        newCount: 0,
      },
      refreshLive: vi.fn(),
    });
  });

  it('announces full-status updates through one polite, atomic live region', () => {
    render(<DataStatus />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).toHaveAttribute('aria-relevant', 'text');
    expect(status).toHaveTextContent('Updating live prices...');
  });

  it('keeps compact status visual-only to prevent duplicate announcements', () => {
    render(<DataStatus variant="compact" />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
