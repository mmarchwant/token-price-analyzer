import React, { useState, useId } from 'react';
import { clsx } from 'clsx';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  id?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, id, position = 'top' }) => {
  const generatedId = useId();
  const tooltipId = id || generatedId;
  const [isVisible, setIsVisible] = useState(false);

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    setIsVisible(true);
    children.props.onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    setIsVisible(false);
    children.props.onMouseLeave?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    setIsVisible(true);
    children.props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    setIsVisible(false);
    children.props.onBlur?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      setIsVisible(false);
    }
    children.props.onKeyDown?.(e);
  };

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const trigger = React.cloneElement(children, {
    'aria-describedby': isVisible ? tooltipId : undefined,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
  });

  return (
    <div className="relative inline-flex">
      {trigger}
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={clsx(
            'absolute z-50 whitespace-nowrap rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900 pointer-events-none transition-opacity duration-150',
            positions[position],
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};
