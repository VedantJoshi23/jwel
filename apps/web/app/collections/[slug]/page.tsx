import type { Metadata } from 'next';
import { getProducts, type ProductSort } from '@/lib/api/products';
import { ProductCard } from '@/components/product/product-card';
import { FilterForm } from '@/components/common/filter-form';
import { Pagination } from '@/components/common/pagination';
import { brand } from '@/lib/brand';

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ metal?: string; sort?: string; page?: string }>;
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = titleCase(slug);
  return {
    title,
    description: `Shop the ${title} collection at ${brand.name} — handcrafted jewellery for every occasion.`,
  };
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page ?? '1');

  // "new-arrivals" and "bestsellers" are curated views (matching the homepage
  // sections of the same name), not real product categories — every other
  // slug is treated as a literal Category.slug.
  const isCuratedView = resolvedParams.slug === 'new-arrivals' || resolvedParams.slug === 'bestsellers';
  const sort = isCuratedView
    ? (resolvedParams.slug === 'bestsellers' ? 'popularity' : 'newest')
    : ((resolvedSearchParams.sort as ProductSort) ?? 'newest');
  const category =
    resolvedParams.slug === 'all' || isCuratedView ? undefined : resolvedParams.slug;

  let result;
  try {
    result = await getProducts(
      { category, metal: resolvedSearchParams.metal || undefined, sort, page, pageSize: 12 },
      30,
    );
  } catch {
    result = { items: [], page: 1, pageSize: 12, total: 0 };
  }

  const collectionTitle = titleCase(resolvedParams.slug);

  return (
    <div>
      {/* Split category hero — wireframe 03 */}
      <div className="grid lg:grid-cols-2">
        <div className="flex items-center bg-[#DFD0B0] px-12 py-14">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight lg:text-5xl">
            {collectionTitle}
            <br />
            <span className="font-normal">Selection</span>
          </h1>
        </div>
        <div
          className="flex min-h-[200px] items-center justify-center bg-[repeating-linear-gradient(45deg,#EDD8B8_0_13px,#E0C8A4_13px_26px)] font-mono text-xs text-[#8f8f8f] lg:min-h-[260px]"
          aria-hidden="true"
        >
          [ category lifestyle image ]
        </div>
      </div>

      <div className="px-6 py-8 lg:px-8">
        {/* Category filter pill strip */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="font-display text-xl font-bold">Filter</span>
          {brand.productTypes.map((type) => {
            const typeSlug = type.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
            const isActive = typeSlug === resolvedParams.slug;
            return (
              <a
                key={type}
                href={`/collections/${typeSlug}`}
                className={`rounded-s border px-5 py-2.5 text-sm font-medium ${
                  isActive
                    ? 'border-brand-primary text-ink-primary'
                    : 'border-border-warm text-ink-primary hover:border-brand-primary'
                }`}
              >
                {type}
              </a>
            );
          })}
        </div>

        {/* Sidebar + grid */}
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <aside aria-label="Filters">
            <FilterForm
              basePath={`/collections/${resolvedParams.slug}`}
              defaultMetal={resolvedSearchParams.metal}
              defaultSort={resolvedSearchParams.sort}
            />
          </aside>

          <div>
            {result.items.length === 0 ? (
              <p className="py-12 text-center text-ink-secondary">
                No products found in this collection yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4">
                {result.items.map((product) => (
                  <div key={product.id} className="bg-surface">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            )}

            <Pagination
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              basePath={`/collections/${resolvedParams.slug}`}
              searchParams={resolvedSearchParams}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
