'use client';

import { cn } from '@/lib/utils';
import type { ProductVariant } from '@/lib/api/types';

export function VariantSelector({
  variants,
  selectedId,
  onSelect,
}: {
  variants: ProductVariant[];
  selectedId: string;
  onSelect: (variantId: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Metal and size options" className="flex flex-wrap gap-3.5">
      {variants.map((variant) => {
        const label = [variant.metal.replace('_', ' '), variant.purity, variant.size].filter(Boolean).join(' · ');
        const selected = variant.id === selectedId;
        return (
          <button
            key={variant.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(variant.id)}
            className={cn(
              'min-h-[44px] rounded-s border px-5 py-2.5 text-sm font-medium',
              selected ? 'border-brand-primary' : 'border-border bg-surface-alt text-ink-secondary',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
