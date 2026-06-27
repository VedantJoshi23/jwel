import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { getProductBySlug, getProductReviews } from '@/lib/api/products';
import { RatingStars } from '@/components/product/rating-stars';
import { CertificationBadge } from '@/components/product/certification-badge';
import { AddToCart } from '@/components/product/add-to-cart';
import { formatMinorUnits } from '@/lib/money';

interface ProductPageProps {
  params: { slug: string };
}

async function loadProduct(slug: string) {
  try {
    return await getProductBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await loadProduct(params.slug);
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await loadProduct(params.slug);
  const reviews = await getProductReviews(product.id).catch(() => ({ items: [], total: 0, page: 1, pageSize: 10 }));
  const minPrice = Math.min(...product.variants.map((v) => v.basePriceMinorUnits));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    category: product.category.name,
    aggregateRating:
      product.ratingCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: product.avgRating,
            reviewCount: product.ratingCount,
          }
        : undefined,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: (minPrice / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <div className="px-6 py-8 lg:px-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="mb-5 flex gap-2 text-sm text-ink-secondary">
        <span>Home</span>
        <span aria-hidden="true">›</span>
        <span>{product.category.name}</span>
        <span aria-hidden="true">›</span>
        <span className="text-ink-primary underline">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div
          className="flex aspect-square items-center justify-center bg-surface-alt font-mono text-xs text-ink-muted"
          aria-label={`Product photo of ${product.name}`}
        >
          [ product shot ]
        </div>

        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">{product.name}</h1>

          <div className="mt-4 flex items-center gap-3.5">
            {Number(product.avgRating) > 0 && (
              <RatingStars value={Number(product.avgRating)} count={product.ratingCount} />
            )}
            {product.certificationType && <CertificationBadge type={product.certificationType} />}
          </div>

          <p className="mt-5 max-w-md text-ink-secondary">{product.description}</p>

          <div className="mt-7">
            <AddToCart product={product} />
          </div>
        </div>
      </div>

      <section aria-labelledby="reviews-heading" className="mt-16 max-w-2xl">
        <h2 id="reviews-heading" className="font-display text-2xl font-bold">
          Reviews
        </h2>
        {reviews.items.length === 0 ? (
          <p className="mt-3 text-ink-secondary">No reviews yet for this product.</p>
        ) : (
          <ul className="mt-5 space-y-6">
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
        )}
      </section>

      <p className="sr-only">Starting from {formatMinorUnits(minPrice)}</p>
    </div>
  );
}
