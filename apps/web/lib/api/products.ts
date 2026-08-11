import { apiFetch, ApiError } from './client';
import type { PaginatedResult, Product, Review } from './types';

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'popularity';

export interface ProductQuery {
  category?: string;
  metal?: string;
  /**
   * Size value (FEAT-SIZE-TAXONOMY). Scheme-specific — "16" is a ring size,
   * "450" a chain length in mm — so normally sent alongside `category`.
   */
  size?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: ProductSort;
  q?: string;
  page?: number;
  pageSize?: number;
}

// `T extends object` (not `Record<string, ...>`) — a plain interface like
// `ProductQuery` has no index signature, so TS doesn't structurally accept
// it as a `Record<string, ...>` argument even though every property matches
// that value type. The cast inside is safe because every caller only ever
// passes plain objects of string/number/undefined values. Real type error
// this milestone's `tsc --noEmit` run caught, pre-existing from Milestone 6
// and never previously checked.
function toQueryString<T extends object>(query: T): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as Record<string, string | number | undefined>)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

export function getProducts(query: ProductQuery = {}, revalidate: number | false = 60) {
  return apiFetch<PaginatedResult<Product>>(`/products${toQueryString(query)}`, { revalidate });
}

export function getProductBySlug(slug: string, revalidate: number | false = 60) {
  return apiFetch<Product>(`/products/${slug}`, { revalidate });
}

export function getProductReviews(productId: string, page = 1, pageSize = 10) {
  return apiFetch<PaginatedResult<Review>>(
    `/products/${productId}/reviews${toQueryString({ page, pageSize })}`,
    { revalidate: 60 },
  );
}

export interface CreateReviewInput {
  productId: string;
  rating: number;
  title?: string;
  body: string;
}

export function createReview(token: string, input: CreateReviewInput) {
  return apiFetch<Review>('/reviews', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
}

/**
 * The caller's own review for a product, in any moderation state — or `null`
 * if they haven't reviewed it. `FEAT-PENDING-REVIEW-VISIBILITY`.
 *
 * The API 404s for "no review yet" (a normal state, not a failure — see the
 * feature spec §7 edge case 2); this function is what turns that back into a
 * plain `null` for callers, the same way `getProductBySlug`'s 404 becomes
 * `notFound()` rather than a thrown error the caller has to keep unwrapping.
 */
export async function getMyReview(token: string, productId: string): Promise<Review | null> {
  try {
    return await apiFetch<Review>(`/reviews/mine${toQueryString({ productId })}`, { token });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) return null;
    throw error;
  }
}
