import Link from 'next/link';
import type { Product } from '@/lib/api/types';
import { PriceTag } from './price-tag';
import { RatingStars } from './rating-stars';

export function ProductCard({ product }: { product: Product }) {
  const minPrice = Math.min(...product.variants.map((v) => v.basePriceMinorUnits));

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div
        className="flex aspect-square items-center justify-center bg-surface-alt text-center font-mono text-xs text-ink-muted"
        aria-hidden="true"
      >
        [ {product.name} ]
      </div>
      <div className="mt-3.5 space-y-2">
        <p className="font-medium">{product.name}</p>
        {Number(product.avgRating) > 0 && (
          <RatingStars value={Number(product.avgRating)} count={product.ratingCount} />
        )}
        <PriceTag amountMinorUnits={minPrice} />
      </div>
    </Link>
  );
}
