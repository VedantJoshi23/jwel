import type { Metadata } from 'next';
import { getProducts, type ProductSort } from '@/lib/api/products';
import { ProductCard } from '@/components/product/product-card';
import { FilterForm } from '@/components/common/filter-form';
import { Pagination } from '@/components/common/pagination';

interface CollectionPageProps {
  params: { slug: string };
  searchParams: { metal?: string; sort?: string; page?: string };
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function generateMetadata({ params }: CollectionPageProps): Metadata {
  const title = titleCase(params.slug);
  return {
    title,
    description: `Shop the ${title} collection at Jwel — gold, diamond and everyday-wear pieces.`,
  };
}

// "Collections" in the frontend currently maps to the Category taxonomy, not
// the Prisma `Collection` model — there is no Collections API endpoint yet
// (out of Milestone 5's 8-module scope). `slug === 'all'` browses everything
// unfiltered. See FRONTEND.md for the full explanation of this gap.
export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const page = Number(searchParams.page ?? '1');
  const sort = (searchParams.sort as ProductSort) ?? 'newest';
  const category = params.slug === 'all' ? undefined : params.slug;

  let result;
  try {
    result = await getProducts(
      { category, metal: searchParams.metal || undefined, sort, page, pageSize: 12 },
      30,
    );
  } catch {
    result = { items: [], page: 1, pageSize: 12, total: 0 };
  }

  return (
    <div>
      <div className="bg-surface-alt px-6 py-12 lg:px-8">
        <h1 className="font-display text-4xl font-bold">{titleCase(params.slug)}</h1>
      </div>

      <div className="grid gap-8 px-6 py-10 lg:grid-cols-[220px_1fr] lg:px-8">
        <aside aria-label="Filters">
          <FilterForm
            basePath={`/collections/${params.slug}`}
            defaultMetal={searchParams.metal}
            defaultSort={searchParams.sort}
          />
        </aside>

        <div>
          {result.items.length === 0 ? (
            <p className="py-12 text-center text-ink-secondary">No products found in this collection yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {result.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            basePath={`/collections/${params.slug}`}
            searchParams={searchParams}
          />
        </div>
      </div>
    </div>
  );
}
