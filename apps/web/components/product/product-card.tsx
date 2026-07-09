import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/api/types';
import { getProductStockImage } from '@/lib/jewellery-images';
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
        <div className="relative aspect-square overflow-hidden bg-surface-alt">
          <Image
            src={product.media[0]?.url ?? getProductStockImage(product.id)}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </div>
      </div>

      {/* Card body */}
      <div className="space-y-2.5 pt-5">
        <p className="font-medium leading-tight">{product.name}</p>
        {product.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-ink-secondary">{product.description}</p>
        )}
        {Number(product.avgRating) > 0 && (
          <RatingStars value={Number(product.avgRating)} count={product.ratingCount} />
        )}
        <PriceTag amountMinorUnits={minPrice} compareAtMinorUnits={compareAt} />
      </div>
    </Link>
  );
}
