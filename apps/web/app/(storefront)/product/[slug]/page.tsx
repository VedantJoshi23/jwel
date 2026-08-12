import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { getProductBySlug, getProductReviews, getProducts } from '@/lib/api/products';
import { RatingStars } from '@/components/product/rating-stars';
import { ReviewForm } from '@/components/product/review-form';
import { MyReviewStatus } from '@/components/product/my-review-status';
import { QnaSection } from '@/components/product/qna-section';
import { CertificationBadge } from '@/components/product/certification-badge';
import { AddToCart } from '@/components/product/add-to-cart';
import { SizeGuide } from '@/components/product/size-guide';
import { ProductCard } from '@/components/product/product-card';
import { ProductGallery } from '@/components/product/product-gallery';
import { ProductRail } from '@/components/recommendations/product-rail';
import { RecentlyViewedRail } from '@/components/recommendations/recently-viewed-rail';
import { RecordProductView } from '@/components/recommendations/record-product-view';
import { getFrequentlyBoughtTogether } from '@/lib/api/recommendations';
import { formatMinorUnits } from '@/lib/money';
import { brand } from '@/lib/brand';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

async function loadProduct(slug: string) {
  try {
    return await getProductBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: { title: product.name, description: product.description.slice(0, 160), type: 'website' },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  const [reviews, related, boughtTogether] = await Promise.all([
    getProductReviews(product.id).catch(() => ({ items: [], total: 0, page: 1, pageSize: 10 })),
    getProducts({ sort: 'popularity', pageSize: 4 }).catch(() => ({ items: [] })),
    // A rail that cannot load renders as no rail, never as a failed page.
    getFrequentlyBoughtTogether(product.id).catch(() => []),
  ]);

  const minPrice = Math.min(...product.variants.map((v) => v.basePriceMinorUnits));
  const maxPrice = Math.max(...product.variants.map((v) => v.basePriceMinorUnits));
  const compareAt = maxPrice > minPrice ? maxPrice : undefined;
  const discountPct = compareAt
    ? Math.round((1 - minPrice / compareAt) * 100)
    : 0;

  const relatedProducts = (related.items ?? []).filter((p) => p.id !== product.id).slice(0, 4);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    category: product.category.name,
    aggregateRating:
      product.ratingCount > 0
        ? { '@type': 'AggregateRating', ratingValue: product.avgRating, reviewCount: product.ratingCount }
        : undefined,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: brand.currency,
      lowPrice: (minPrice / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <div>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="px-6 py-6 lg:px-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-5 flex gap-2 text-sm text-ink-secondary">
          <Link href="/">Home</Link>
          <span aria-hidden="true">›</span>
          <Link href={`/collections/${product.category.name.toLowerCase()}`}>
            {product.category.name}
          </Link>
          <span aria-hidden="true">›</span>
          <span className="text-ink-primary underline">{product.name}</span>
        </nav>

        {/* 2-col product layout — switches to side-by-side at `md` (768px) so a
            tablet in portrait doesn't stack a ~full-width square image above
            the details, forcing a long scroll before reaching "Add to bag". */}
        <div className="grid gap-10 md:grid-cols-2">
          {/* Product image */}
          <ProductGallery media={product.media} productId={product.id} productName={product.name} />

          {/* Product details */}
          <div>
            <h1 className="font-display text-4xl font-bold leading-[1.02] tracking-tight lg:text-[42px]">
              {product.name}
            </h1>
            {product.variants[0]?.metal && (
              <p className="mt-2 text-lg font-semibold">{String(product.variants[0].metal).replace(/_/g, ' ')}</p>
            )}

            {/* Ratings */}
            <div className="mt-4 flex items-center gap-3.5">
              {Number(product.avgRating) > 0 && (
                <RatingStars value={Number(product.avgRating)} count={product.ratingCount} />
              )}
              {product.certificationType && <CertificationBadge type={product.certificationType} />}
            </div>

            <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-secondary">
              {product.description}
            </p>

            {/* Price — variant selection, quantity, and the actual "Add to bag"
                control all live inside AddToCart; this is just the marketing
                price context (MRP/discount) shown once, above it. */}
            <div className="mt-7">
              {compareAt && (
                <p className="mb-1 text-sm text-ink-muted line-through">
                  MRP {formatMinorUnits(compareAt)}
                </p>
              )}
              <div className="flex items-center gap-3">
                <span className="font-display text-4xl font-bold text-brand-ink">
                  {formatMinorUnits(minPrice)}
                </span>
                {discountPct > 0 && (
                  <span className="bg-brand-primary px-3 py-1 text-xs font-bold tracking-wide text-white">
                    {discountPct}% OFF
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-brand-ink">Extra ₹300 off at checkout</p>
            </div>

            {/* Add to cart */}
            <div className="mt-6">
              <AddToCart product={product} />
            </div>

            {/* Size guide — renders nothing for categories with no sizing
                scheme, so this is mounted unconditionally
                (FEAT-SIZE-TAXONOMY). */}
            <SizeGuide scheme={product.category?.sizeScheme} />

            {/* Shipping note */}
            <p className="mt-4 text-xs text-ink-muted">{brand.pdp.shippingNote}</p>
          </div>
        </div>
      </div>

      {/* You May Also Love */}
      {relatedProducts.length > 0 && (
        <section className="bg-surface-alt px-6 py-12 lg:px-8">
          <h2 className="mb-8 text-center font-display text-3xl font-bold tracking-tight">
            {brand.pdp.relatedHeadline}
          </h2>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/*
        Recommendation rails. `DOM-RECOMMENDATION`'s endpoints all existed with
        nothing calling them — including the view recorder these rails are
        computed from, which is why they had no data to work with.

        "Frequently bought together" is fetched on the server: it depends only
        on the product, so it can render with the page. "Recently viewed"
        cannot — it needs the guest identity in this browser's localStorage.
      */}
      <div className="px-6 lg:px-8">
        <ProductRail title="Frequently bought together" products={boughtTogether} />
        <RecentlyViewedRail excludeProductId={product.id} />
      </div>

      {/* Reviews */}
      <section aria-labelledby="reviews-heading" className="px-6 py-12 lg:px-8">
        <h2 id="reviews-heading" className="font-display text-2xl font-bold">
          Reviews
        </h2>
        {reviews.items.length === 0 ? (
          <div className="mt-3">
            <MyReviewStatus
              productId={product.id}
              emptyFallback={<p className="text-ink-secondary">No reviews yet for this product.</p>}
            />
          </div>
        ) : (
          <>
            <div className="mt-5 max-w-2xl">
              <MyReviewStatus productId={product.id} />
            </div>
            <ul className="mt-5 max-w-2xl space-y-6">
              {reviews.items.map((review) => (
                <li key={review.id} className="border-b border-border pb-5">
                  <div className="flex items-center gap-3">
                    <RatingStars value={review.rating} />
                    {review.verifiedPurchase && (
                      <span className="text-xs font-medium text-feedback-success">Verified purchase</span>
                    )}
                  </div>
                  {review.title && <p className="mt-2 font-medium">{review.title}</p>}
                  <p className="mt-1 text-sm text-ink-secondary">{review.body}</p>
                </li>
              ))}
            </ul>
          </>
        )}

        <ReviewForm productId={product.id} />
      </section>

      {/* Q&A — FEAT-PRODUCT-QA. Client-fetched island, not part of this
          page's server-side Promise.all; see qna-section.tsx for why. */}
      <section aria-labelledby="qna-heading" className="px-6 py-12 lg:px-8">
        <h2 id="qna-heading" className="font-display text-2xl font-bold">
          Questions &amp; Answers
        </h2>
        <QnaSection productId={product.id} />
      </section>

      {/* Renders nothing; records that this product was viewed. */}
      <RecordProductView productId={product.id} />

      <p className="sr-only">Starting from {formatMinorUnits(minPrice)}</p>
    </div>
  );
}
