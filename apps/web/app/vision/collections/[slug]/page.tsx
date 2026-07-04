import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getProducts, type ProductSort } from '@/lib/api/products';
import { brand } from '@/lib/brand';
import { getCategoryBannerImage } from '@/lib/jewellery-images';
import { ScrollReveal } from '@/components/cinematic/scroll-reveal';
import { VisionProductCard } from '@/components/vision/product/vision-product-card';
import { VisionFilterForm } from '@/components/vision/vision-filter-form';
import { VisionPagination } from '@/components/vision/vision-pagination';

interface VisionCollectionPageProps {
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

export async function generateMetadata({ params }: VisionCollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = titleCase(slug);
  return {
    title: `${title} — Vision Concept`,
    description: `An unlisted concept view of the ${title} collection — not the live storefront.`,
    robots: { index: false, follow: false },
  };
}

export default async function VisionCollectionPage({ params, searchParams }: VisionCollectionPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page ?? '1');

  // Same curated-view handling as the real storefront collection page:
  // "new-arrivals"/"bestsellers" are sorted virtual views, every other slug is
  // a literal Category.slug.
  const isCuratedView = resolvedParams.slug === 'new-arrivals' || resolvedParams.slug === 'bestsellers';
  const sort = isCuratedView
    ? (resolvedParams.slug === 'bestsellers' ? 'popularity' : 'newest')
    : ((resolvedSearchParams.sort as ProductSort) ?? 'newest');
  const category = resolvedParams.slug === 'all' || isCuratedView ? undefined : resolvedParams.slug;

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
  const basePath = `/vision/collections/${resolvedParams.slug}`;

  return (
    <>
      {/* Immersive dark hero — intentionally stays dark in both themes, same
          treatment as the vision PDP hero and homepage photo sections. */}
      <section className="relative flex h-[60vh] min-h-[420px] items-end overflow-hidden bg-[#0A0A0C]">
        <Image
          src={getCategoryBannerImage(resolvedParams.slug)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-[#0A0A0C]/30 to-transparent" />

        <div className="relative z-[2] w-full px-[8vw] pb-14">
          <Link
            href="/vision"
            data-vision-magnet
            className="mb-6 inline-block text-[10px] uppercase text-[#F5F1EA]/60"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
          >
            ← Vision
          </Link>
          <p
            className="mb-4 text-[10px] uppercase text-[#C8A24A]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
          >
            — Collection —
          </p>
          <h1
            className="text-[clamp(36px,7vw,96px)] leading-[1] tracking-tight text-[#F5F1EA]"
            style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
          >
            {collectionTitle}
          </h1>
        </div>
      </section>

      {/* Body — plain surface, flips with the theme toggle. */}
      <section className="bg-[rgb(var(--v-bg))] px-[8vw] py-[8vh]">
        {/* Category pill strip */}
        <div className="mb-10 flex flex-wrap items-center gap-3">
          <span
            className="text-[10px] uppercase text-[rgb(var(--v-ink)/0.5)]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.3em' }}
          >
            Filter
          </span>
          {brand.productTypes.map((type) => {
            const typeSlug = type.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
            const isActive = typeSlug === resolvedParams.slug;
            return (
              <Link
                key={type}
                href={`/vision/collections/${typeSlug}`}
                data-vision-magnet
                className={`border px-5 py-2.5 text-[11px] uppercase transition-colors ${
                  isActive
                    ? 'border-[rgb(var(--v-gold))] text-[rgb(var(--v-ink))]'
                    : 'border-[rgb(var(--v-ink)/0.2)] text-[rgb(var(--v-ink)/0.6)] hover:border-[rgb(var(--v-gold))]'
                }`}
                style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.15em' }}
              >
                {type}
              </Link>
            );
          })}
        </div>

        <div className="grid gap-10 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]">
          <aside aria-label="Filters">
            <details className="mb-6 border border-[rgb(var(--v-ink)/0.15)] md:hidden">
              <summary
                className="cursor-pointer select-none px-4 py-3 text-[11px] uppercase text-[rgb(var(--v-ink))]"
                style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.2em' }}
              >
                Filters
              </summary>
              <div className="border-t border-[rgb(var(--v-ink)/0.15)] px-4 py-5">
                <VisionFilterForm
                  basePath={basePath}
                  defaultMetal={resolvedSearchParams.metal}
                  defaultSort={resolvedSearchParams.sort}
                  defaultPriceMin={resolvedSearchParams.priceMin}
                  defaultPriceMax={resolvedSearchParams.priceMax}
                />
              </div>
            </details>
            <div className="hidden md:block">
              <VisionFilterForm
                basePath={basePath}
                defaultMetal={resolvedSearchParams.metal}
                defaultSort={resolvedSearchParams.sort}
                defaultPriceMin={resolvedSearchParams.priceMin}
                defaultPriceMax={resolvedSearchParams.priceMax}
              />
            </div>
          </aside>

          <div>
            {result.items.length === 0 ? (
              <p className="py-16 text-center text-sm text-[rgb(var(--v-ink)/0.5)]">
                No pieces found in this collection yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                {result.items.map((product, i) => (
                  <ScrollReveal key={product.id} delay={i * 0.05}>
                    <VisionProductCard product={product} />
                  </ScrollReveal>
                ))}
              </div>
            )}

            <VisionPagination
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              basePath={basePath}
              searchParams={resolvedSearchParams}
            />
          </div>
        </div>
      </section>
    </>
  );
}
