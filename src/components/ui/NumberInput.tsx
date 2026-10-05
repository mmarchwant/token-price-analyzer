import React, { useState, useEffect, useId } from 'react';
import { clsx } from 'clsx';

export interface NumberInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    { label, value, onChange, min, max, step = 1, prefix, suffix, id, className, onBlur, ...props },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [localValue, setLocalValue] = useState<string>(String(value));

    useEffect(() => {
      setLocalValue(String(value));
    }, [value]);

    const clampValue = (valStr: string): number => {
      let num = parseFloat(valStr);
      if (isNaN(num)) {
        num = min !== undefined ? min : 0;
      }
      if (min !== undefined && num < min) {
        num = min;
      }
      if (max !== undefined && num > max) {
        num = max;
      }
      return num;
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const clamped = clampValue(localValue);
      setLocalValue(String(clamped));
      onChange(clamped);
      if (onBlur) {
        onBlur(e);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value);
    };

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center rounded-lg shadow-xs">
          {prefix && (
            <span className="absolute left-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 select-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type="number"
            min={min}
            max={max}
            step={step}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            className={clsx(
              'block w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium tabular-nums text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-indigo-400',
              prefix && 'pl-7',
              suffix && 'pr-8',
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 select-none">
              {suffix}
            </span>
          )}
        </div>
      </div>
    );
  },
);

NumberInput.displayName = 'NumberInput';
