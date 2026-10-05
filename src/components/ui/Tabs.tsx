import React, { useRef } from 'react';
import { clsx } from 'clsx';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  content?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  ariaLabel = 'Tabs',
  className,
}) => {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const enabledTabs = tabs.filter((t) => !t.disabled);
    if (enabledTabs.length === 0) return;

    let nextIndex = currentIndex;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % tabs.length;
      while (tabs[nextIndex]?.disabled) {
        nextIndex = (nextIndex + 1) % tabs.length;
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      while (tabs[nextIndex]?.disabled) {
        nextIndex = (nextIndex - 1 + tabs.length) % tabs.length;
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
      while (tabs[nextIndex]?.disabled && nextIndex < tabs.length - 1) {
        nextIndex++;
      }
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabs.length - 1;
      while (tabs[nextIndex]?.disabled && nextIndex > 0) {
        nextIndex--;
      }
    }

    if (nextIndex !== currentIndex && tabs[nextIndex]) {
      const nextTab = tabs[nextIndex]!;
      onChange(nextTab.id);
      const btn = tabRefs.current.get(nextTab.id);
      btn?.focus();
    }
  };

  const activeItem = tabs.find((t) => t.id === activeTab);

  return (
    <div className={clsx('flex flex-col gap-4', className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex border-b border-zinc-200 dark:border-zinc-800 gap-2 overflow-x-auto"
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={clsx(
                'px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-t-md',
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:border-zinc-700',
                tab.disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeItem?.content && (
        <div
          id={`panel-${activeItem.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeItem.id}`}
          tabIndex={0}
          className="focus:outline-none"
        >
          {activeItem.content}
        </div>
      )}
    </div>
  );
};
