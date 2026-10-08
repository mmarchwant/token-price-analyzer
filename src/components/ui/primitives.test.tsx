import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { ErrorState, Tabs, Toggle, NumberInput, Tooltip } from './index';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('UI Primitives', () => {
  describe('Tabs keyboard navigation', () => {
    const TestTabsComponent = () => {
      const [active, setActive] = useState('tab1');
      return (
        <Tabs
          activeTab={active}
          onChange={setActive}
          tabs={[
            { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
            { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
            { id: 'tab3', label: 'Tab 3', content: <div>Content 3</div> },
          ]}
        />
      );
    };

    it('navigates tabs using Arrow keys, Home, and End', async () => {
      render(<TestTabsComponent />);
      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      const tab3 = screen.getByRole('tab', { name: 'Tab 3' });

      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Content 1')).toBeInTheDocument();

      tab1.focus();

      // Right arrow moves to Tab 2
      fireEvent.keyDown(tab1, { key: 'ArrowRight' });
      expect(tab2).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Content 2')).toBeInTheDocument();

      // Right arrow moves to Tab 3
      fireEvent.keyDown(tab2, { key: 'ArrowRight' });
      expect(tab3).toHaveAttribute('aria-selected', 'true');

      // Right arrow wraps to Tab 1
      fireEvent.keyDown(tab3, { key: 'ArrowRight' });
      expect(tab1).toHaveAttribute('aria-selected', 'true');

      // Left arrow wraps to Tab 3
      fireEvent.keyDown(tab1, { key: 'ArrowLeft' });
      expect(tab3).toHaveAttribute('aria-selected', 'true');

      // Home key moves to Tab 1
      fireEvent.keyDown(tab3, { key: 'Home' });
      expect(tab1).toHaveAttribute('aria-selected', 'true');

      // End key moves to Tab 3
      fireEvent.keyDown(tab1, { key: 'End' });
      expect(tab3).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Toggle component', () => {
    it('handles click and space/enter key events', () => {
      const handleChange = vi.fn();
      render(<Toggle checked={false} onChange={handleChange} label="Enable option" />);

      const toggleButton = screen.getByRole('switch', { name: 'Enable option' });
      expect(toggleButton).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(toggleButton);
      expect(handleChange).toHaveBeenCalledWith(true);

      fireEvent.keyDown(toggleButton, { key: ' ' });
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });

  describe('NumberInput clamping', () => {
    const TestNumberInput = () => {
      const [val, setVal] = useState<number>(10);
      return <NumberInput label="Quantity" value={val} onChange={setVal} min={5} max={20} />;
    };

    it('clamps value on blur when below min or above max', async () => {
      const user = userEvent.setup();
      render(<TestNumberInput />);

      const input = screen.getByLabelText('Quantity') as HTMLInputElement;
      expect(input.value).toBe('10');

      // Enter value below min (2)
      await user.clear(input);
      await user.type(input, '2');
      fireEvent.blur(input);
      expect(input.value).toBe('5');

      // Enter value above max (50)
      await user.clear(input);
      await user.type(input, '50');
      fireEvent.blur(input);
      expect(input.value).toBe('20');
    });
  });

  describe('Tooltip focus and hover behavior', () => {
    it('shows tooltip on mouse enter and keyboard focus, uses aria-describedby', async () => {
      render(
        <Tooltip content="Tooltip text" id="my-tooltip">
          <button>Hover or Focus Me</button>
        </Tooltip>,
      );

      const button = screen.getByRole('button', { name: 'Hover or Focus Me' });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Keyboard focus
      fireEvent.focus(button);
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent('Tooltip text');
      expect(button).toHaveAttribute('aria-describedby', 'my-tooltip');

      // Blur
      fireEvent.blur(button);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Mouse enter
      fireEvent.mouseEnter(button);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Mouse leave
      fireEvent.mouseLeave(button);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('ErrorState', () => {
    it.each([
      ['en', 'An error occurred', 'Please try again later.', 'Retry'],
      ['pl', 'Wystąpił błąd', 'Spróbuj ponownie później.', 'Spróbuj ponownie'],
    ])('uses localized %s defaults', async (language, title, message, retryLabel) => {
      await i18n.changeLanguage(language);
      render(<ErrorState onRetry={vi.fn()} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(title);
      expect(alert).toHaveTextContent(message);
      expect(screen.getByRole('button', { name: retryLabel })).toBeInTheDocument();
    });

    it('uses assertive, atomic error announcements', () => {
      render(<ErrorState />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
      expect(alert).toHaveAttribute('aria-atomic', 'true');
      expect(alert).toHaveAttribute('aria-relevant', 'additions text');
    });

    it('allows callers to override every displayed label', () => {
      render(
        <ErrorState
          title="Custom title"
          message="Custom message"
          retryLabel="Try again"
          onRetry={vi.fn()}
        />,
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Custom title');
      expect(screen.getByRole('alert')).toHaveTextContent('Custom message');
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
  });
});
