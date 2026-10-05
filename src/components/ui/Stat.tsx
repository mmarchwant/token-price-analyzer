import React from 'react';
import { clsx } from 'clsx';

export interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}

export const Stat: React.FC<StatProps> = ({ label, value, hint, className }) => {
  return (
    <div
      className={clsx(
        'flex flex-col p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xs',
        className,
      )}
    >
      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
        {label}
      </span>
      <span className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
        {value}
      </span>
      {hint && <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
    </div>
  );
};
