import { formatMinorUnits } from '@/lib/money';

export function OrderSummary({
  subtotalMinorUnits,
  discountMinorUnits = 0,
  shippingMinorUnits = 0,
}: {
  subtotalMinorUnits: number;
  discountMinorUnits?: number;
  shippingMinorUnits?: number;
}) {
  const total = subtotalMinorUnits - discountMinorUnits + shippingMinorUnits;

  return (
    <dl className="space-y-2.5 border border-border p-5">
      <div className="flex justify-between text-sm">
        <dt>Subtotal</dt>
        <dd>{formatMinorUnits(subtotalMinorUnits)}</dd>
      </div>
      {discountMinorUnits > 0 && (
        <div className="flex justify-between text-sm text-feedback-success">
          <dt>Discount</dt>
          <dd>-{formatMinorUnits(discountMinorUnits)}</dd>
        </div>
      )}
      <div className="flex justify-between text-sm">
        <dt>Shipping</dt>
        <dd>{shippingMinorUnits === 0 ? 'Free' : formatMinorUnits(shippingMinorUnits)}</dd>
      </div>
      <div className="flex justify-between border-t border-border pt-2.5 font-display text-lg font-bold">
        <dt>Total</dt>
        <dd>{formatMinorUnits(total)}</dd>
      </div>
    </dl>
  );
}
