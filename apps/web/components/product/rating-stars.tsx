import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RatingStars({
  value,
  count,
  className,
}: {
  value: number;
  count?: number;
  className?: string;
}) {
  const rounded = Math.round(value);
  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars${count !== undefined ? `, ${count} reviews` : ''}`}
    >
      <span className="flex" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn('h-4 w-4', i < rounded ? 'fill-brand-accent text-brand-accent' : 'text-border')}
          />
        ))}
      </span>
      {count !== undefined && <span className="text-sm text-ink-secondary">{count} reviews</span>}
    </div>
  );
}
