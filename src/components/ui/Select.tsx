import React, { useId } from 'react';
import { clsx } from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  label?: string;
  options: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, id, className, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            'block w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-indigo-400 cursor-pointer shadow-xs',
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  },
);

Select.displayName = 'Select';
