'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { VariantSelector } from './variant-selector';
import { QuantityStepper } from './quantity-stepper';
import { PriceTag } from './price-tag';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/api/types';

export function AddToCart({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const { addLine } = useCart();

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  if (!variant) {
    return <p className="text-feedback-warning">This product is currently unavailable.</p>;
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

      <p role="status" aria-live="polite" className="text-sm text-feedback-success">
        {confirmed ? `Added ${product.name} to your bag.` : ''}
      </p>
    </div>
  );
}
