import React from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const variants = {
      primary:
        'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 shadow-xs',
      secondary:
        'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 shadow-xs',
      ghost:
        'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
      danger:
        'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500 shadow-xs',
    };

    const sizes = {
      sm: 'px-2.5 py-1.5 text-xs rounded-md gap-1.5',
      md: 'px-3.5 py-2 text-sm rounded-lg gap-2',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={clsx(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
