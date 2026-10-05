import React, { useId } from 'react';
import { clsx } from 'clsx';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  id,
  disabled = false,
  className,
}) => {
  const generatedId = useId();
  const toggleId = id || generatedId;

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div className={clsx('flex items-center justify-between gap-4', className)}>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <label
              htmlFor={toggleId}
              className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer select-none"
              onClick={handleClick}
            >
              {label}
            </label>
          )}
          {description && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 select-none">
              {description}
            </span>
          )}
        </div>
      )}
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label || 'Toggle switch'}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed',
          checked ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700',
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
};
