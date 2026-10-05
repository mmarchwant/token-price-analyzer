import React from 'react';
import { clsx } from 'clsx';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
Card.displayName = 'Card';

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'p-5 pb-3 font-semibold border-b border-zinc-100 dark:border-zinc-800/80',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
CardHeader.displayName = 'CardHeader';

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, as: Component = 'h3', ...props }, ref) => (
    <Component
      ref={ref}
      className={clsx(
        'text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  ),
);
CardTitle.displayName = 'CardTitle';

export type CardContentProps = React.HTMLAttributes<HTMLDivElement>;

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={clsx('p-5', className)} {...props}>
      {children}
    </div>
  ),
);
CardContent.displayName = 'CardContent';
