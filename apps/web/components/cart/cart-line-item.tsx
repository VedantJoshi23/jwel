'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { QuantityStepper } from '@/components/product/quantity-stepper';
import { PriceTag } from '@/components/product/price-tag';
import { getProductStockImage } from '@/lib/jewellery-images';
import type { CartLine } from '@/lib/cart-store';

export function CartLineItemRow({
  line,
  onQuantityChange,
  onRemove,
}: {
  line: CartLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-5 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:gap-5 sm:px-5">
      <div className="relative aspect-square overflow-hidden bg-surface-alt">
        <Image
          src={getProductStockImage(line.productSlug)}
          alt={line.productName}
          fill
          sizes="(min-width: 640px) 120px, 84px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{line.productName}</p>
        <p className="text-sm text-ink-secondary">
          {line.metal.replace('_', ' ')}
          {line.size ? ` · ${line.size}` : ''}
        </p>
        <PriceTag amountMinorUnits={line.unitPriceMinorUnits} className="mt-2" />
        <div className="mt-3 flex flex-wrap items-center gap-3 sm:gap-5">
          <QuantityStepper value={line.quantity} onChange={onQuantityChange} />
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 text-sm text-ink-secondary underline"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Remove
          </button>
        </div>
      </div>
      <p className="font-display text-base font-bold sm:text-lg">
        {(line.unitPriceMinorUnits * line.quantity / 100).toLocaleString('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        })}
      </p>
    </div>
  );
}
