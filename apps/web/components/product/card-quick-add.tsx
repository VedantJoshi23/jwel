'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useCartDrawer } from '@/lib/cart-drawer-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/api/types';

/**
 * The hover-revealed "Add to Cart" bar on a product card, per the client's
 * reference image. Rings and several other categories need a metal/size
 * chosen before an add is meaningful — `VariantSelector` exists for exactly
 * that on the PDP — so a card with more than one variant cannot add blind:
 * it opens a compact inline picker instead, rather than either guessing a
 * variant or silently falling back to the PDP and losing the "quick" part of
 * quick-add.
 *
 * Always adds quantity 1, matching the reference — a card has no room for a
 * quantity stepper, and the PDP is where a bulk add belongs.
 *
 * Sits as a sibling of the card's image `<Link>`, not a descendant of it —
 * see `WishlistHeartButton` for why a button cannot nest inside an anchor.
 */
export function CardQuickAdd({ product }: { product: Product }) {
  const [picking, setPicking] = useState(false);
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const { addLine, isMutating } = useCart();
  const openBag = useCartDrawer((s) => s.open);

  if (product.variants.length === 0) return null;
  const singleVariant = product.variants.length === 1 ? product.variants[0] : null;

  async function add(id: string) {
    await addLine({ variantId: id, quantity: 1 });
    setConfirmed(true);
    setPicking(false);
    setTimeout(() => setConfirmed(false), 2000);

    // The drawer lists what is in the bag, so the piece needs no describing
    // from here.
    openBag();
  }

  const barClassName = cn(
    // Visible by default (a phone has no hover to reveal it on), hidden on
    // desktop until the card is hovered or something inside this bar has
    // keyboard focus — `group-focus-within` so a keyboard user tabbing onto
    // the button is never the one visitor who cannot find it, the same
    // reasoning the header's own collapse behaviour follows.
    'pointer-events-auto absolute inset-x-0 bottom-0 z-10 p-2.5 opacity-100 transition-opacity',
    'md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100',
    'md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100',
  );

  if (confirmed) {
    return (
      <div className={barClassName}>
        <Button size="s" className="w-full" disabled>
          <Check className="h-4 w-4" aria-hidden="true" />
          Added
        </Button>
      </div>
    );
  }

  if (singleVariant) {
    return (
      <div className={barClassName}>
        <Button
          size="s"
          className="w-full"
          loading={isMutating}
          onClick={() => void add(singleVariant.id)}
        >
          Add to bag
        </Button>
      </div>
    );
  }

  if (!picking) {
    return (
      <div className={barClassName}>
        <Button
          size="s"
          variant="secondary"
          className="w-full bg-surface"
          onClick={() => setPicking(true)}
        >
          Choose options
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(barClassName, 'space-y-2 rounded-m bg-surface/95 shadow-glass backdrop-blur')}>
      {/*
        The same radio-group pattern as the PDP's VariantSelector, compacted
        for a card's width — not a reuse of that component directly, since it
        sizes for a full page column rather than a ~250px card and has no
        concept of "collapse back out."
      */}
      <div role="radiogroup" aria-label={`Options for ${product.name}`} className="flex flex-wrap gap-1.5">
        {product.variants.map((variant) => {
          const label = [variant.metal.replace('_', ' '), variant.purity, variant.size]
            .filter(Boolean)
            .join(' · ');
          const selected = variant.id === variantId;
          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setVariantId(variant.id)}
              className={cn(
                'min-h-[32px] rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors',
                selected ? 'border-brand-ink bg-brand-ink/10' : 'border-border bg-surface text-ink-secondary',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        <Button
          size="s"
          className="flex-1"
          loading={isMutating}
          onClick={() => void add(variantId)}
        >
          Add
        </Button>
        <Button
          size="s"
          variant="ghost"
          aria-label="Cancel choosing options"
          onClick={() => setPicking(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
