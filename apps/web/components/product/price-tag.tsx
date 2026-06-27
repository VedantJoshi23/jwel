import { formatMinorUnits } from '@/lib/money';
import { cn } from '@/lib/utils';

export function PriceTag({
  amountMinorUnits,
  compareAtMinorUnits,
  className,
}: {
  amountMinorUnits: number;
  compareAtMinorUnits?: number;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-baseline gap-2 bg-surface-alt px-3 py-1 text-sm font-medium', className)}>
      {formatMinorUnits(amountMinorUnits)}
      {compareAtMinorUnits && compareAtMinorUnits > amountMinorUnits && (
        <span className="text-xs text-ink-muted line-through">{formatMinorUnits(compareAtMinorUnits)}</span>
      )}
    </span>
  );
}
