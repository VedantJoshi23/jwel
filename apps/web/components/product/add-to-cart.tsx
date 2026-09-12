'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useCartDrawer } from '@/lib/cart-drawer-store';
import { VariantSelector } from './variant-selector';
import { QuantityStepper } from './quantity-stepper';
import { PriceTag } from './price-tag';
import { Button } from '@/components/ui/button';
import { SaveToWishlist } from './save-to-wishlist';
import type { Product } from '@/lib/api/types';

export function AddToCart({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const { addLine } = useCart();
  const openBag = useCartDrawer((s) => s.open);

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  if (!variant) {
    return <p className="text-feedback-warning">This product is currently unavailable.</p>;
  }

  async function handleAddToBag() {
    // Only the variant and the quantity: the server holds the name, the price
    // and everything else, so nothing here can disagree with the catalogue.
    // The old local cart carried a copy of all of it and could drift.
    await addLine({ variantId: variant.id, quantity });
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 3000);

    // The inline `role="status"` line below stays as the quiet announcement
    // for anyone who does not get the drawer's focus move. The header's
    // cart-icon pop (components/layout/header.tsx) is the third leg,
    // reacting to `itemCount` on its own rather than being triggered here.
    // The drawer names the piece itself, so nothing is passed to it.
    openBag();
  }

  return (
    <div className="space-y-6">
      <VariantSelector variants={product.variants} selectedId={variant.id} onSelect={setVariantId} />

      <div>
        <p className="mb-3 font-display text-lg font-bold">Quantity</p>
        <div className="flex items-center justify-between">
          <QuantityStepper value={quantity} onChange={setQuantity} />
          <PriceTag amountMinorUnits={variant.basePriceMinorUnits * quantity} className="text-lg" />
        </div>
      </div>

      <Button size="l" className="w-full" onClick={handleAddToBag}>
        Add to bag
      </Button>

      {/* Saves the selected variant, not the product — see SaveToWishlist. */}
      <SaveToWishlist variantId={variant.id} productName={product.name} />

      <p role="status" aria-live="polite" className="text-sm text-feedback-success">
        {confirmed ? `Added ${product.name} to your bag.` : ''}
      </p>
    </div>
  );
}
