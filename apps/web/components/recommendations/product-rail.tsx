import Image from 'next/image';
import Link from 'next/link';
import { formatMinorUnits } from '@/lib/money';
import { getProductStockImage } from '@/lib/jewellery-images';
import type { RecommendedProduct } from '@/lib/api/types';

/**
 * A row of recommended products.
 *
 * **Renders nothing when there is nothing to show.** A rail headed
 * "Frequently bought together" above an empty strip tells a shopper the shop is
 * broken; saying nothing tells them nothing, which is the honest answer when
 * there is no signal yet. The catalogue is small and the order history is
 * thin, so empty is the common case rather than the edge one
 * (`DOM-RECOMMENDATION` §8.2).
 */
export function ProductRail({
  title,
  products,
}: {
  title: string;
  products: RecommendedProduct[];
}) {
  if (products.length === 0) return null;

  return (
    <section className="py-10">
      <h2 className="mb-5 font-display text-2xl font-bold">{title}</h2>
      {/* A list, so a screen reader announces how many there are before
          reading them out. */}
      <ul className="grid grid-cols-2 gap-5 md:grid-cols-4">
        {products.map((product) => (
          <li key={product.productId}>
            <Link href={`/product/${product.slug}`} className="group block">
              <div className="relative aspect-square overflow-hidden bg-surface-alt">
                <Image
                  src={getProductStockImage(product.slug)}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <p className="mt-2 text-sm font-medium">{product.name}</p>
              <p className="text-sm text-ink-secondary">
                {formatMinorUnits(product.priceMinMinorUnits)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
