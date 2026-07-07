'use client';

import type { ProductVariant } from '@/lib/api/types';

export function VisionVariantSelector({
  variants,
  selectedId,
  onSelect,
}: {
  variants: ProductVariant[];
  selectedId: string;
  onSelect: (variantId: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Metal and size options" className="flex flex-wrap gap-3">
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
            data-vision-magnet
            className={`min-h-[44px] border px-5 py-2.5 text-[11px] uppercase transition-colors ${
              selected
                ? 'border-[rgb(var(--v-gold))] text-[rgb(var(--v-ink))]'
                : 'border-[rgb(var(--v-ink)/0.2)] text-[rgb(var(--v-ink)/0.6)] hover:border-[rgb(var(--v-ink)/0.4)]'
            }`}
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.15em' }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
