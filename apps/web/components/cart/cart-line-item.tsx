'use client';

import { X } from 'lucide-react';
import { QuantityStepper } from '@/components/product/quantity-stepper';
import { PriceTag } from '@/components/product/price-tag';
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
    <div className="grid grid-cols-[120px_1fr_auto] items-center gap-5 border-b border-border py-5">
      <div
        className="flex aspect-square items-center justify-center bg-surface-alt font-mono text-[10px] text-ink-muted"
        aria-hidden="true"
      >
        [ image ]
      </div>
      <div>
        <p className="font-medium">{line.productName}</p>
        <p className="text-sm text-ink-secondary">
          {line.metal.replace('_', ' ')}
          {line.size ? ` · ${line.size}` : ''}
        </p>
        <PriceTag amountMinorUnits={line.unitPriceMinorUnits} className="mt-2" />
        <div className="mt-3 flex items-center gap-5">
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
      <p className="font-display text-lg font-bold">
        {(line.unitPriceMinorUnits * line.quantity / 100).toLocaleString('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        })}
      </p>
    </div>
  );
}
