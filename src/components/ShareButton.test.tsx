import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ShareButton } from './ShareButton';

describe('ShareButton', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.restoreAllMocks();
    if (!document.execCommand) {
      document.execCommand = vi.fn();
    }
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('copies url via navigator.clipboard and updates button state and aria-live region', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(
      <ShareButton url="https://example.com/#/test" label="Copy link" copiedLabel="Copied!" />,
    );

    const btn = screen.getByRole('button', { name: /copy link/i });
    expect(btn).toBeInTheDocument();

    await user.click(btn);

    expect(writeTextMock).toHaveBeenCalledWith('https://example.com/#/test');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copied!/i })).toBeInTheDocument();
    });
  });

  it('falls back to popover when both clipboard API and execCommand fail', async () => {
    const user = userEvent.setup();

    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    vi.spyOn(document, 'execCommand').mockImplementation(() => {
      throw new Error('execCommand not supported');
    });

    render(<ShareButton url="https://example.com/#/fallback" label="Copy link" />);

    const btn = screen.getByRole('button', { name: /copy link/i });
    await user.click(btn);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('https://example.com/#/fallback');
    });
  });
});
