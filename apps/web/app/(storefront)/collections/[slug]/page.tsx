import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategoryBySlug, getProducts, type ProductSort } from '@/lib/api/products';
import { ApiError } from '@/lib/api/client';
import type { SizeScheme } from '@/lib/api/types';
import { ProductCard } from '@/components/product/product-card';
import { FilterForm } from '@/components/common/filter-form';
import { Pagination } from '@/components/common/pagination';
import { brand } from '@/lib/brand';
import { getCategoryBannerImage } from '@/lib/jewellery-images';
import { safeGetCollectionBySlug } from '@/lib/api/collections';
import { safeGetSizes } from '@/lib/api/sizes';
import { CollectionView } from '@/components/collection/collection-view';
import { RevealSection } from '@/components/motion/reveal';

// Answered by this route itself, ahead of any lookup: `all` is the whole
// catalogue and the other two are curated sorts. The API refuses to let a
// Collection be created under any of these names (CollectionsService's
// RESERVED_SLUGS) precisely because a collection here would be unreachable.
const ROUTE_OWNED_SLUGS = ['all', 'new-arrivals', 'bestsellers'];

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    metal?: string;
    sort?: string;
    page?: string;
    priceMin?: string;
    priceMax?: string;
    size?: string;
  }>;
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * A slug that is neither route-owned nor a curated Collection must be a real
 * Category, or the page is a 404. Previously any slug at all rendered: a
 * mistyped or stale link — including the one the product breadcrumb built
 * from a category's display name — showed an empty grid titled with the raw
 * URL ("Bracelets%20%26%20…") and returned 200.
 *
 * Existence, not product count, is the test. A real category that happens to
 * be empty is not "not found", and the product listing alone cannot tell the
 * two apart. Any failure other than a 404 is rethrown for the error boundary:
 * a 404 served because the API blipped would be a lie, and a cacheable one.
 */
async function loadCategory(slug: string) {
  try {
    return await getCategoryBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;

  // Deliberately the same default arguments the page body uses below. Next
  // memoizes identical fetches within one render pass, so on page 1 — the
  // overwhelmingly common case — these two calls collapse into one request.
  // Asking for a cheaper page size here would only break that.
  if (!ROUTE_OWNED_SLUGS.includes(slug)) {
    const collection = await safeGetCollectionBySlug(slug);
    if (collection) {
      return {
        title: collection.name,
        description:
          collection.description ??
          `Shop the ${collection.name} collection at ${brand.name} — handcrafted jewellery for every occasion.`,
      };
    }
  }

  const title = ROUTE_OWNED_SLUGS.includes(slug) ? titleCase(slug) : (await loadCategory(slug)).name;
  return {
    title,
    description: `Shop the ${title} collection at ${brand.name} — handcrafted jewellery for every occasion.`,
  };
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page ?? '1');

  // Collection first, Category second. The two share this URL space, and the
  // API guards both directions against a slug collision
  // (CollectionsService.assertSlugIsFree and its mirror in ProductsService),
  // so at most one of them can ever answer to a given slug.
  //
  // Skipped entirely for the three slugs this route answers itself — that is
  // a request the API can never satisfy, so there is no reason to spend a
  // round trip discovering it.
  if (!ROUTE_OWNED_SLUGS.includes(resolvedParams.slug)) {
    const collection = await safeGetCollectionBySlug(resolvedParams.slug, page);
    if (collection) {
      return <CollectionView collection={collection} searchParams={resolvedSearchParams} />;
    }
  }

  // "new-arrivals" and "bestsellers" are curated views (matching the homepage
  // sections of the same name), not real product categories — every other
  // slug is treated as a literal Category.slug.
  const isCuratedView = resolvedParams.slug === 'new-arrivals' || resolvedParams.slug === 'bestsellers';
  const sort = isCuratedView
    ? (resolvedParams.slug === 'bestsellers' ? 'popularity' : 'newest')
    : ((resolvedSearchParams.sort as ProductSort) ?? 'newest');
  const category =
    resolvedParams.slug === 'all' || isCuratedView ? undefined : resolvedParams.slug;
  // Same request as generateMetadata's, so Next serves it from one fetch.
  const categoryRecord = category ? await loadCategory(category) : undefined;

  const priceMin = resolvedSearchParams.priceMin ? Number(resolvedSearchParams.priceMin) * 100 : undefined;
  const priceMax = resolvedSearchParams.priceMax ? Number(resolvedSearchParams.priceMax) * 100 : undefined;

  let result;
  try {
    result = await getProducts(
      {
        category,
        metal: resolvedSearchParams.metal || undefined,
        size: resolvedSearchParams.size || undefined,
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

  // Resolved via a second, filter-free lookup (category only — no metal/
  // price/size) rather than off `result.items[0]`. Reading it from the
  // active result broke as soon as the *current* filter combination itself
  // produced zero matches: the whole Size section vanished along with the
  // listing, taking "Any size" with it and leaving no way back to a wider
  // result. This answers "does this category have a sizing scheme at all,"
  // which is the question that actually determines whether the filter
  // belongs on the page — not "did this specific filter combination match."
  let sizeScheme: SizeScheme | null = null;
  if (category) {
    try {
      const categoryProbe = await getProducts({ category, pageSize: 1 }, 30);
      sizeScheme = categoryProbe.items[0]?.category?.sizeScheme ?? null;
    } catch {
      sizeScheme = null;
    }
  }
  const sizeOptions = await safeGetSizes(sizeScheme);

  // The category's own name — "Bracelets & Bangles" — rather than one rebuilt
  // from its slug, which turned the ampersand into "And".
  const collectionTitle = categoryRecord?.name ?? titleCase(resolvedParams.slug);

  return (
    <div>
      {/* Split category hero — wireframe 03.
          Tighter below `md` only. On a 390px phone the hero, its image and
          three rows of wrapped filter chips used to push the first product to
          ~780px down an 844px screen, so tapping "Shop" showed no jewellery at
          all until the visitor scrolled. From `md` up this is unchanged. */}
      <div className="grid md:grid-cols-2">
        <div className="flex items-center bg-surface-band px-6 py-8 md:px-12 md:py-14">
          <h1 className="font-display text-3xl font-bold leading-[1.05] tracking-tight md:text-4xl lg:text-5xl">
            {collectionTitle}
            <br />
            <span className="font-normal">Selection</span>
          </h1>
        </div>
        <div className="relative min-h-[112px] md:min-h-[260px]" aria-hidden="true">
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
        {/* Category filter pill strip. One sideways-scrolling row on phones
            instead of three wrapped rows; bleeds to the screen edges so a
            chip cut off at the edge reads as "there is more this way". The
            chips are links, so the row needs no tabindex of its own to be
            keyboard-reachable. Wraps as before from `md` up. */}
        <div className="-mx-6 mb-6 flex items-center gap-3 overflow-x-auto px-6 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
          <span className="shrink-0 font-display text-xl font-bold">Filter</span>
          {brand.productTypes.map((type) => {
            const typeSlug = type.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
            const isActive = typeSlug === resolvedParams.slug;
            return (
              <a
                key={type}
                href={`/collections/${typeSlug}`}
                className={`shrink-0 whitespace-nowrap rounded-sm border px-5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-brand-ink bg-brand-ink/10 text-ink-primary'
                    : 'border-border-warm text-ink-primary hover:border-brand-ink'
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
            <details className="mb-6 rounded-sm border border-border md:hidden">
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
            sizeOptions={sizeOptions}
            defaultSize={resolvedSearchParams.size}
                />
              </div>
            </details>
            {/* The form previously rendered with no padding of its own,
                flush against the sidebar column's edges — a `material-card`
                panel gives it the same breathing room and rounded, glassy
                treatment every other content surface on the page already
                has, instead of bare controls floating in the gutter. */}
            <div className="material-card hidden rounded-m border border-border p-5 md:block">
              <FilterForm
                basePath={`/collections/${resolvedParams.slug}`}
                defaultMetal={resolvedSearchParams.metal}
                defaultSort={resolvedSearchParams.sort}
                defaultPriceMin={resolvedSearchParams.priceMin}
                defaultPriceMax={resolvedSearchParams.priceMax}
            sizeOptions={sizeOptions}
            defaultSize={resolvedSearchParams.size}
              />
            </div>
          </aside>

          <div>
            {result.items.length === 0 ? (
              <p className="py-12 text-center text-ink-secondary">
                No products found in this collection yet.
              </p>
            ) : (
              <RevealSection className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
                {result.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </RevealSection>
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
