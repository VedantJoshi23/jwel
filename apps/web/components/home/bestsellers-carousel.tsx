'use client';

import { useState } from 'react';
import { ProductCard } from '@/components/product/product-card';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/api/types';

const VISIBLE_COUNT = 2;

/**
 * A forward-only carousel: one arrow, no way back. That's a deliberate
 * product decision, not a missing "previous" button — the request was
 * specifically "user cannot go to the left side."
 *
 * Infinite, not one-shot: after the last real item, the next click loops
 * back to the first rather than disabling the arrow, so a shopper who keeps
 * clicking sees everything again instead of hitting a dead end.
 *
 * Implementation: the track renders the real items plus a duplicate of the
 * first `VISIBLE_COUNT` appended at the tail. Advancing past the real end
 * slides into that duplicate — visually identical to the true start — and
 * once the transition lands there, the index resets to 0 with the CSS
 * transition switched off for one frame. The reset is invisible because the
 * duplicate and the real start render pixel-identical.
 */
export function BestsellersCarousel({ products }: { products: Product[] }) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);

  if (products.length === 0) return null;

  // Nothing to reveal by advancing when everything already fits on screen.
  const canAdvance = products.length > VISIBLE_COUNT;
  const extended = canAdvance ? [...products, ...products.slice(0, VISIBLE_COUNT)] : products;

  function handleNext() {
    setAnimate(true);
    setIndex((i) => i + 1);
  }

  function handleTransitionEnd() {
    if (index >= products.length) {
      setAnimate(false);
      setIndex(0);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <div className="-mx-3 flex-1 overflow-hidden">
        <div
          onTransitionEnd={handleTransitionEnd}
          className={cn('flex', animate && 'transition-transform duration-500 ease-out')}
          style={{ transform: `translateX(-${index * (100 / VISIBLE_COUNT)}%)` }}
        >
          {extended.map((product, i) => (
            <div key={`${product.id}-${i}`} className="w-1/2 shrink-0 px-3">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
      {canAdvance && (
        <button
          type="button"
          onClick={handleNext}
          aria-label="Show the next bestseller"
          className="shrink-0 text-3xl font-light text-ink-muted transition-colors hover:text-ink-primary"
        >
          ›
        </button>
      )}
    </div>
  );
}
