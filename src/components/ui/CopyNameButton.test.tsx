import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyNameButton } from './CopyNameButton';

describe('CopyNameButton', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });

  it('copies the supplied name and exposes localized copied feedback', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onCopied = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <CopyNameButton
        text="openai/gpt-5.1"
        ariaLabel="Copy model name"
        copiedLabel="Model name copied"
        onCopied={onCopied}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copy model name' }));

    expect(writeText).toHaveBeenCalledWith('openai/gpt-5.1');
    expect(onCopied).toHaveBeenCalledWith('openai/gpt-5.1');
    await waitFor(() => {
      expect(screen.getByText('Model name copied')).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('copies through native keyboard activation while retaining its supplied accessible name', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <CopyNameButton text="Pro plan" ariaLabel="Copy plan name" copiedLabel="Plan name copied" />,
    );

    const button = screen.getByRole('button', { name: 'Copy plan name' });
    button.focus();
    await user.keyboard('{Enter}');

    expect(writeText).toHaveBeenCalledWith('Pro plan');
    expect(screen.getByRole('button', { name: 'Copy plan name' })).toBe(button);
  });
});
