import React from 'react';
import { clsx } from 'clsx';
import { Button } from './Button';

export interface ErrorStateProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  title = 'An error occurred',
  onRetry,
  className,
}) => {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center p-6 text-center rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 my-6',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-400 mb-3">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-red-900 dark:text-red-200">{title}</h3>
      <p className="mt-1 text-sm text-red-700 dark:text-red-300 max-w-md">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="danger" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};
