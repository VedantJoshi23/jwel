import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-m border px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'border-border bg-surface-alt text-ink-secondary',
        accent: 'border-brand-accent/40 bg-brand-accent/10 text-brand-accent',
        success: 'border-feedback-success/30 bg-feedback-success/10 text-feedback-success',
        warning: 'border-feedback-warning/30 bg-feedback-warning/10 text-feedback-warning',
        error: 'border-feedback-error/30 bg-feedback-error/10 text-feedback-error',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
