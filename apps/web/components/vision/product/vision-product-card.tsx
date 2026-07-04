import Image from 'next/image';
import Link from 'next/link';
import { formatMinorUnits } from '@/lib/money';
import { getProductStockImage } from '@/lib/jewellery-images';
import type { Product } from '@/lib/api/types';

export function VisionProductCard({ product }: { product: Product }) {
  const minPrice = Math.min(...product.variants.map((v) => v.basePriceMinorUnits));
  const image = product.media[0]?.storageRef.startsWith('http')
    ? product.media[0].storageRef
    : getProductStockImage(product.id);

  return (
    <Link href={`/vision/product/${product.slug}`} data-vision-magnet className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-[rgb(var(--v-bg-soft))]">
        <Image
          src={image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 90vw"
          className="object-cover opacity-90 transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>
      <div className="mt-5 flex items-baseline justify-between gap-3">
        <span
          className="text-lg leading-tight text-[rgb(var(--v-ink))]"
          style={{ fontFamily: 'var(--vision-font-serif)' }}
        >
          {product.name}
        </span>
        <span
          className="shrink-0 text-xs text-[rgb(var(--v-gold))]"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.1em' }}
        >
          {formatMinorUnits(minPrice)}
        </span>
      </div>
    </Link>
  );
}
