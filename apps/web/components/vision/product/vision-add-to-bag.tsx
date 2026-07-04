'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { brand } from '@/lib/brand';
import type { Product } from '@/lib/api/types';
import { VisionVariantSelector } from './vision-variant-selector';
import { VisionQuantityStepper } from './vision-quantity-stepper';
import { VisionPrice } from './vision-price';

/** Mirrors components/product/add-to-cart.tsx's exact state/logic — same
 * useCart() store, same addLine() payload — so an item added here shows up
 * in the real site's cart/checkout too. Only the markup is vision-themed. */
export function VisionAddToBag({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const { addLine } = useCart();

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  if (!variant) {
    return (
      <p className="text-sm text-[rgb(var(--v-ink)/0.6)]">This piece is currently unavailable.</p>
    );
  }

  function handleAddToBag() {
    addLine({
      variantId: variant.id,
      productSlug: product.slug,
      productName: product.name,
      metal: variant.metal,
      size: variant.size,
      unitPriceMinorUnits: variant.basePriceMinorUnits,
      quantity,
    });
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 3000);
  }

  return (
    <div className="space-y-8">
      {product.variants.length > 1 && (
        <VisionVariantSelector variants={product.variants} selectedId={variant.id} onSelect={setVariantId} />
      )}

      <div className="flex items-center justify-between">
        <VisionQuantityStepper value={quantity} onChange={setQuantity} />
        <VisionPrice amountMinorUnits={variant.basePriceMinorUnits * quantity} />
      </div>

      <button
        type="button"
        onClick={handleAddToBag}
        data-vision-magnet
        className="w-full bg-[rgb(var(--v-gold))] py-4 text-xs uppercase text-[rgb(var(--v-bg))] transition-transform hover:scale-[1.01]"
        style={{ fontFamily: 'var(--vision-font-sans)', fontWeight: 500, letterSpacing: '.3em' }}
      >
        {brand.pdp.addToBagLabel}
      </button>

      <p role="status" aria-live="polite" className="text-xs text-[rgb(var(--v-gold))]">
        {confirmed ? `Added ${product.name} to your bag.` : ''}
      </p>
    </div>
  );
}
