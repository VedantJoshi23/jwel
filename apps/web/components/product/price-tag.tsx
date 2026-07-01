import { formatMinorUnits } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Displays a product price following the GLINT wireframe pattern:
 *  - If on sale: MRP strikethrough + discount % badge, then sale price on
 *    cream (#F7E8C0 / price-bg) background in crimson
 *  - If not on sale: price on price-bg background
 */
export function PriceTag({
  amountMinorUnits,
  compareAtMinorUnits,
  className,
}: {
  amountMinorUnits: number;
  compareAtMinorUnits?: number;
  className?: string;
}) {
  const onSale = !!compareAtMinorUnits && compareAtMinorUnits > amountMinorUnits;
  const discountPct = onSale
    ? Math.round((1 - amountMinorUnits / compareAtMinorUnits!) * 100)
    : 0;

  return (
    <div className={cn('space-y-1', className)}>
      {onSale && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted line-through">
            {formatMinorUnits(compareAtMinorUnits!)}
          </span>
          <span className="bg-brand-primary px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
            {discountPct}% OFF
          </span>
        </div>
      )}
      <span className="inline-block bg-price-bg px-3 py-1 text-sm font-bold text-brand-primary">
        {formatMinorUnits(amountMinorUnits)}
      </span>
    </div>
  );
}
