import React from 'react';
import { clsx } from 'clsx';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, className }) => {
  return (
    <div
      className={clsx(
        'flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-6 mb-6 border-b border-zinc-200 dark:border-zinc-800',
        className,
      )}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
};
