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
              // Pill, not box — this always was DESIGN.md §3's spec for
              // `VariantSelector` ("pill-group"); the implementation had
              // drifted to `rounded-s`, ADR-0019 brings it back in line.
              'min-h-[44px] rounded-full border px-5 py-2.5 text-sm font-medium transition-colors',
              selected ? 'border-brand-ink bg-brand-ink/10' : 'border-border bg-surface-alt text-ink-secondary',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
