import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { buildShareUrl } from '../state/urlState';

export interface ShareButtonProps {
  url?: string;
  label?: string;
  copiedLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  url,
  label,
  copiedLabel,
  variant = 'secondary',
  size = 'sm',
  className,
}) => {
  const { t } = useTranslation('common');
  const [copied, setCopied] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayLabel = label ?? t('actions.copyLink');
  const displayCopiedLabel = copiedLabel ?? t('actions.copied');

  const getTargetUrl = () => {
    return url || buildShareUrl();
  };

  const handleCopy = async () => {
    const targetUrl = getTargetUrl();

    // Strategy 1: navigator.clipboard.writeText
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(targetUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        // Fall back to execCommand
      }
    }

    // Strategy 2: document.execCommand('copy') fallback
    let textarea: HTMLTextAreaElement | null = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = targetUrl;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');

      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      // Fall back to popover
    } finally {
      if (textarea && textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }

    // Strategy 3: Popover for manual copy
    setShowPopover(true);
  };

  return (
    <div className="relative inline-block">
      {/* Screen reader polite announcement */}
      <div aria-live="polite" className="sr-only">
        {copied ? displayCopiedLabel : ''}
      </div>

      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleCopy}
      >
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          {copied ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          )}
        </svg>
        <span>{copied ? displayCopiedLabel : displayLabel}</span>
      </Button>

      {/* Popover Fallback */}
      {showPopover && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {t('actions.shareUrl')}
            </span>
            <button
              type="button"
              onClick={() => setShowPopover(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold"
            >
              ×
            </button>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400">{t('actions.manualCopyPrompt')}</p>
          <input
            ref={inputRef}
            type="text"
            readOnly
            value={getTargetUrl()}
            onFocus={(e) => e.target.select()}
            className="w-full px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100 text-xs font-mono select-all"
          />
        </div>
      )}
    </div>
  );
};
