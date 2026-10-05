import React from 'react';
import { clsx } from 'clsx';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={clsx('animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800', className)}
      {...props}
    />
  );
};
