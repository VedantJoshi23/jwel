import Image from 'next/image';
import { ProductCard } from '@/components/product/product-card';
import { Pagination } from '@/components/common/pagination';
import { getCategoryBannerImage } from '@/lib/jewellery-images';
import type { CollectionWithProducts } from '@/lib/api/types';

interface CollectionViewProps {
  collection: CollectionWithProducts;
  searchParams: Record<string, string | undefined>;
}

/**
 * The curated-collection page: a fixed, hand-picked set of products.
 *
 * Deliberately does not render the filter sidebar or the metal/price/sort
 * controls the category view has. Those exist to narrow a large catalogue
 * down; a collection is already the narrowing, chosen by a merchandiser in a
 * specific order. Offering "sort by price" over a curated lookbook would let
 * a shopper destroy the only thing that made it a collection.
 */
export function CollectionView({ collection, searchParams }: CollectionViewProps) {
  const { products } = collection;

  return (
    <div>
      <div className="grid md:grid-cols-2">
        <div className="flex flex-col justify-center gap-4 bg-[#DFD0B0] px-12 py-14">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight lg:text-5xl">
            {collection.name}
          </h1>
          {collection.description && (
            <p className="max-w-md text-sm leading-relaxed text-ink-secondary">
              {collection.description}
            </p>
          )}
        </div>
        <div className="relative min-h-[200px] md:min-h-[260px]" aria-hidden="true">
          <Image
            // Falls back to the same placeholder the category hero uses when
            // no hero has been uploaded, rather than collapsing the layout to
            // a half-empty band.
            src={collection.heroImageUrl ?? getCategoryBannerImage(collection.slug)}
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>

      <div className="px-6 py-8 lg:px-8">
        {products.items.length === 0 ? (
          <p className="py-12 text-center text-ink-secondary">
            This collection is being put together — check back shortly.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
            {products.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <Pagination
          page={products.page}
          pageSize={products.pageSize}
          total={products.total}
          basePath={`/collections/${collection.slug}`}
          searchParams={searchParams}
        />
      </div>
    </div>
  );
}
