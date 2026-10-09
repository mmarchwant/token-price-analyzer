import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

export interface CopyNameButtonProps {
  /** The model or plan name written to the clipboard. */
  text: string;
  /** Localized accessible name, for example "Copy GPT-5.1 name". */
  ariaLabel: string;
  /** Localized polite announcement made after a successful copy. */
  copiedLabel: string;
  /** Lets the owning feature provide any additional localized copied feedback. */
  onCopied?: (text: string) => void;
  className?: string;
  disabled?: boolean;
}

export function CopyNameButton({
  text,
  ariaLabel,
  copiedLabel,
  onCopied,
  className,
  disabled = false,
}: CopyNameButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== undefined) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied?.(text);

      if (resetTimeoutRef.current !== undefined) {
        clearTimeout(resetTimeoutRef.current);
      }
      resetTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permissions can be denied; leave the control ready to retry.
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled}
        onClick={handleCopy}
        className={clsx(
          'inline-flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:ring-offset-zinc-900',
          className,
        )}
      >
        {copied ? (
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 13 4 4L19 7" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2M7 8H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H7Z"
            />
          </svg>
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? copiedLabel : ''}
      </span>
    </>
  );
}
