import { formatMinorUnits } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Displays a product price:
 *  - If on sale: MRP strikethrough + discount % badge, then sale price on
 *    the price-bg background in the brand color
 *  - If not on sale: price on price-bg background
 * Figures render in font-mono (IBM Plex Mono) — see globals.css's --font-mono.
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
          <span className="font-mono text-xs text-ink-muted line-through">
            {formatMinorUnits(compareAtMinorUnits!)}
          </span>
          <span className="bg-brand-primary px-1.5 py-0.5 font-mono text-[9px] font-bold leading-none text-white">
            {discountPct}% OFF
          </span>
        </div>
      )}
      <span className="inline-block bg-price-bg px-3 py-1 font-mono text-sm font-bold text-brand-ink">
        {formatMinorUnits(amountMinorUnits)}
      </span>
    </div>
  );
}
