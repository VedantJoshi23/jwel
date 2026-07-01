import Link from 'next/link';
import type { Product } from '@/lib/api/types';
import { PriceTag } from './price-tag';
import { RatingStars } from './rating-stars';

interface ProductCardProps {
  product: Product;
  /** Show "NEW ARRIVAL" circular badge — used on homepage new arrivals section */
  isNew?: boolean;
}

export function ProductCard({ product, isNew }: ProductCardProps) {
  const minPrice = Math.min(...product.variants.map((v) => v.basePriceMinorUnits));
  // Use the highest variant price as the compare-at (MRP) if variants differ
  const maxPrice = Math.max(...product.variants.map((v) => v.basePriceMinorUnits));
  const compareAt = maxPrice > minPrice ? maxPrice : undefined;

  return (
    <Link href={`/product/${product.slug}`} className="group block bg-surface">
      {/* Image placeholder with optional NEW ARRIVAL badge */}
      <div className="relative">
        {isNew && (
          <div
            className="absolute left-3 top-3 z-10 flex h-14 w-14 items-center justify-center rounded-full border border-brand-primary bg-surface text-center font-mono text-[8px] font-semibold leading-tight text-ink-primary"
            aria-label="New arrival"
          >
            NEW
            <br />
            ARRIVAL
          </div>
        )}
        <div
          className="flex aspect-square items-center justify-center bg-surface-alt font-mono text-xs text-ink-muted"
          aria-hidden="true"
        >
          [ {product.name} ]
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-2">
        <p className="font-medium leading-tight">{product.name}</p>
        {product.description && (
          <p className="line-clamp-2 text-xs text-ink-secondary">{product.description}</p>
        )}
        {Number(product.avgRating) > 0 && (
          <RatingStars value={Number(product.avgRating)} count={product.ratingCount} />
        )}
        <PriceTag amountMinorUnits={minPrice} compareAtMinorUnits={compareAt} />
      </div>
    </Link>
  );
}
