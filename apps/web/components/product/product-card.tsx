import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/api/types';
import { getProductStockImage } from '@/lib/jewellery-images';
import { cn } from '@/lib/utils';
import { PriceTag } from './price-tag';
import { RatingStars } from './rating-stars';
import { WishlistHeartButton } from './wishlist-heart-button';
import { CardQuickAdd } from './card-quick-add';

interface ProductCardProps {
  product: Product;
  /** Show "NEW ARRIVAL" circular badge — used on homepage new arrivals section */
  isNew?: boolean;
  /**
   * Skip native lazy-loading for this card's image. Needed for carousels
   * (e.g. BestsellersCarousel): every slide is already mounted in the DOM,
   * just translated off to the side, so the browser's lazy-load heuristic
   * treats far-right slides as "not near the viewport yet" and defers their
   * fetch until the slide animation brings them on screen — which reads as
   * a blank card that only fills in after the download finishes, worse the
   * faster the user clicks through slides. Eager-loading the small, fixed
   * set of carousel images up front avoids that.
   */
  eager?: boolean;
}

export function ProductCard({ product, isNew, eager }: ProductCardProps) {
  const minPrice = Math.min(...product.variants.map((v) => v.basePriceMinorUnits));
  // The variant the card actually shows a price for — matters for the
  // wishlist heart below, which saves one specific variant (DOM-SHOPPING
  // Invariant 7: a wishlist line has no quantity or "any variant" concept).
  // `variants[0]` would silently save a different, possibly pricier, piece
  // than the one the customer just looked at.
  const cheapestVariant =
    product.variants.find((v) => v.basePriceMinorUnits === minPrice) ?? product.variants[0];
  // Use the highest variant price as the compare-at (MRP) if variants differ
  const maxPrice = Math.max(...product.variants.map((v) => v.basePriceMinorUnits));
  const compareAt = maxPrice > minPrice ? maxPrice : undefined;

  return (
    // `overflow-hidden` here is load-bearing, not decorative: `material-card`
    // gives this Link rounded corners, and without clipping, the sharp-edged
    // photo beneath sat flush against the card boundary and visibly poked
    // past the rounded corners at all four points — a rounded frame around an
    // un-rounded photo, which is exactly the "boxy" look the roundness was
    // supposed to remove. Clipping the image to the card's own radius is what
    // makes the two read as one considered shape instead of two mismatched
    // ones. The card body gets its own padding for the same reason: it used
    // to sit flush against the card's left/right/bottom edges with nothing
    // but `pt-5` above it.
    // No longer one `<Link>` around the whole card: the quick-add button and
    // the wishlist heart are interactive controls, and a `<button>` (or
    // another `<a>`) nested inside an `<a>` is invalid HTML that browsers
    // resolve inconsistently. Two `Link`s to the same product instead — one
    // around the image, one around the title/body — with the overlay
    // controls as siblings of the image link, positioned over it with
    // `absolute`. A screen reader announces the destination twice, once per
    // link; both carry the same accessible name, so that reads as
    // reinforcement, not confusion.
    <div className="material-card group relative flex h-full flex-col overflow-hidden">
      {/* Image + overlays. `relative` here, not just on the aspect-square
          image div below, is what lets the heart and quick-add bar position
          themselves against the whole image area rather than needing to
          know its rendered height. */}
      <div className="relative">
        {isNew && (
          <div
            className="absolute left-3 top-3 z-10 flex h-14 w-14 items-center justify-center rounded-full border border-brand-ink bg-surface text-center font-mono text-[8px] font-semibold leading-tight text-ink-primary"
            aria-label="New arrival"
          >
            NEW
            <br />
            ARRIVAL
          </div>
        )}
        <Link href={`/product/${product.slug}`} className="block">
          <div className="relative aspect-square overflow-hidden bg-surface-alt">
            <Image
              src={product.media[0]?.url ?? getProductStockImage(product.id)}
              alt={product.name}
              fill
              loading={eager ? 'eager' : undefined}
              sizes="(min-width: 1024px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </div>
        </Link>
        <WishlistHeartButton
          variantId={cheapestVariant?.id ?? ''}
          productName={product.name}
          className={cn('absolute right-3 z-10', isNew ? 'top-20' : 'top-3')}
        />
        <CardQuickAdd product={product} />
      </div>

      {/* Card body — flex-col with the price pinned to `mt-auto` so cards of
          different title/description/rating length still end at the same
          height and the price sits flush at the bottom of every card. */}
      <Link href={`/product/${product.slug}`} className="flex flex-1 flex-col space-y-2.5 p-4">
        <p className="line-clamp-2 font-medium leading-tight">{product.name}</p>
        {product.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-ink-secondary">{product.description}</p>
        )}
        {Number(product.avgRating) > 0 && (
          <RatingStars value={Number(product.avgRating)} count={product.ratingCount} />
        )}
        <PriceTag amountMinorUnits={minPrice} compareAtMinorUnits={compareAt} className="mt-auto" />
      </Link>
    </div>
  );
}
