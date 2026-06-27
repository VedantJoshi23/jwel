import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Variants map to DESIGN.md §3 `Button` component spec.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-s text-cta font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-primary text-white hover:bg-brand-primary/90',
        secondary: 'border border-brand-primary text-brand-primary hover:bg-brand-primary/5',
        ghost: 'text-ink-primary hover:bg-surface-alt',
        destructive: 'bg-feedback-error text-white hover:bg-feedback-error/90',
      },
      size: {
        s: 'h-9 px-4 text-sm',
        m: 'h-11 px-6 text-sm',
        l: 'h-12 px-8 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'm' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
