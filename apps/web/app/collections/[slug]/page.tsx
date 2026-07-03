import Image from 'next/image';
import type { Metadata } from 'next';
import { getProducts, type ProductSort } from '@/lib/api/products';
import { ProductCard } from '@/components/product/product-card';
import { FilterForm } from '@/components/common/filter-form';
import { Pagination } from '@/components/common/pagination';
import { brand } from '@/lib/brand';
import { getCategoryBannerImage } from '@/lib/jewellery-images';

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    metal?: string;
    sort?: string;
    page?: string;
    priceMin?: string;
    priceMax?: string;
  }>;
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

  const priceMin = resolvedSearchParams.priceMin ? Number(resolvedSearchParams.priceMin) * 100 : undefined;
  const priceMax = resolvedSearchParams.priceMax ? Number(resolvedSearchParams.priceMax) * 100 : undefined;

  let result;
  try {
    result = await getProducts(
      {
        category,
        metal: resolvedSearchParams.metal || undefined,
        priceMin,
        priceMax,
        sort,
        page,
        pageSize: 12,
      },
      30,
    );
  } catch {
    result = { items: [], page: 1, pageSize: 12, total: 0 };
  }

  const collectionTitle = titleCase(resolvedParams.slug);

  return (
    <div>
      {/* Split category hero — wireframe 03 */}
      <div className="grid md:grid-cols-2">
        <div className="flex items-center bg-[#DFD0B0] px-12 py-14">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight lg:text-5xl">
            {collectionTitle}
            <br />
            <span className="font-normal">Selection</span>
          </h1>
        </div>
        <div className="relative min-h-[200px] md:min-h-[260px]" aria-hidden="true">
          <Image
            src={getCategoryBannerImage(resolvedParams.slug)}
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
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

        {/* Sidebar + grid — permanent sidebar from `md` up (768px): a tablet
            has plenty of room for it, no reason to make it wait for `lg`. */}
        <div className="grid gap-8 md:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr]">
          <aside aria-label="Filters">
            <details className="mb-6 rounded-s border border-border md:hidden">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold">
                Filters
              </summary>
              <div className="border-t border-border px-4 py-5">
                <FilterForm
                  basePath={`/collections/${resolvedParams.slug}`}
                  defaultMetal={resolvedSearchParams.metal}
                  defaultSort={resolvedSearchParams.sort}
                  defaultPriceMin={resolvedSearchParams.priceMin}
                  defaultPriceMax={resolvedSearchParams.priceMax}
                />
              </div>
            </details>
            <div className="hidden md:block">
              <FilterForm
                basePath={`/collections/${resolvedParams.slug}`}
                defaultMetal={resolvedSearchParams.metal}
                defaultSort={resolvedSearchParams.sort}
                defaultPriceMin={resolvedSearchParams.priceMin}
                defaultPriceMax={resolvedSearchParams.priceMax}
              />
            </div>
          </aside>

          <div>
            {result.items.length === 0 ? (
              <p className="py-12 text-center text-ink-secondary">
                No products found in this collection yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
                {result.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
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
