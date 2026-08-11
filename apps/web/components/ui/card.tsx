import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // `material-card` gives every Card the glass surface and the hover lift in
  // both themes (ADR-0019); `rounded-m` replaces the flat-edged box admin
  // data tables and stat cards used to render in. No `bg-surface` alongside
  // it: Tailwind's utility layer sits after `@layer components`, so a `bg-*`
  // utility here would silently outrank `.material-card`'s own background and
  // flatten the glass to opaque — `.material-card` already supplies it.
  return (
    <div className={cn('material-card rounded-m border border-border', className)} {...props} />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}
