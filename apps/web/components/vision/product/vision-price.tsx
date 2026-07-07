import { formatMinorUnits } from '@/lib/money';

export function VisionPrice({
  amountMinorUnits,
  compareAtMinorUnits,
  className,
}: {
  amountMinorUnits: number;
  compareAtMinorUnits?: number;
  className?: string;
}) {
  const onSale = !!compareAtMinorUnits && compareAtMinorUnits > amountMinorUnits;
  const discountPct = onSale ? Math.round((1 - amountMinorUnits / compareAtMinorUnits!) * 100) : 0;

  return (
    <div className={className}>
      {onSale && (
        <p className="mb-1 text-sm text-[rgb(var(--v-ink)/0.5)] line-through">
          {formatMinorUnits(compareAtMinorUnits!)}
        </p>
      )}
      <div className="flex items-center gap-3">
        <span
          className="text-[clamp(28px,4vw,44px)] leading-none text-[rgb(var(--v-gold))]"
          style={{ fontFamily: 'var(--vision-font-serif)' }}
        >
          {formatMinorUnits(amountMinorUnits)}
        </span>
        {discountPct > 0 && (
          <span
            className="text-[10px] uppercase text-[rgb(var(--v-ink))]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.2em' }}
          >
            {discountPct}% off
          </span>
        )}
      </div>
    </div>
  );
}
