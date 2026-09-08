import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // rounded-sm (10px) — see button.tsx's comment on the Lavender Rose
        // redesign superseding ADR-0019's pill shape.
        'material-raised flex h-11 w-full rounded-sm border border-border bg-surface px-4 text-sm text-ink-primary placeholder:text-ink-muted disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
