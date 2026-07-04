import { Star } from 'lucide-react';

export function VisionRating({ value, count, className }: { value: number; count?: number; className?: string }) {
  const rounded = Math.round(value);
  return (
    <div
      className={className}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars${count !== undefined ? `, ${count} reviews` : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex gap-0.5" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${i < rounded ? 'fill-[rgb(var(--v-gold))] text-[rgb(var(--v-gold))]' : 'text-[rgb(var(--v-ink)/0.2)]'}`}
            />
          ))}
        </span>
        {count !== undefined && (
          <span className="text-xs text-[rgb(var(--v-ink)/0.5)]">{count} reviews</span>
        )}
      </div>
    </div>
  );
}
