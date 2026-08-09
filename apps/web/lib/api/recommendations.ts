import { apiFetch } from './client';
import type { RecommendedProduct } from './types';

/**
 * `DOM-RECOMMENDATION` — every one of these endpoints existed with no
 * storefront surface reaching it, including the view recorder that the
 * recently-viewed and personalised rails are computed from. Nothing was
 * tracking views, so those rails had nothing to be built out of.
 */

/**
 * Best-effort telemetry. A failure here must never surface to the shopper: a
 * product page that errors because an analytics write failed is a worse
 * outcome than a rail being one view out of date.
 */
export async function recordProductView(
  productId: string,
  anonymousId: string | null,
  token?: string | null,
): Promise<void> {
  try {
    await apiFetch<void>(`/products/${productId}/views`, {
      method: 'POST',
      token: token ?? undefined,
      body: JSON.stringify({ anonymousId: anonymousId ?? undefined }),
    });
  } catch {
    // Deliberately swallowed — see above.
  }
}

export function getRecentlyViewed(anonymousId: string | null, token?: string | null, limit = 6) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (anonymousId) params.set('anonymousId', anonymousId);
  return apiFetch<RecommendedProduct[]>(`/recently-viewed?${params}`, {
    token: token ?? undefined,
    cache: 'no-store',
  });
}

export function getFrequentlyBoughtTogether(productId: string, limit = 4) {
  return apiFetch<RecommendedProduct[]>(
    `/products/${productId}/recommendations/frequently-bought-together?limit=${limit}`,
    { cache: 'no-store' },
  );
}

export function getTrending(limit = 8) {
  return apiFetch<RecommendedProduct[]>(`/recommendations/trending?limit=${limit}`, {
    cache: 'no-store',
  });
}

/** Signed-in only — the "recommended for you" rail. */
export function getPersonalized(token: string, limit = 8) {
  return apiFetch<RecommendedProduct[]>(`/me/recommendations?limit=${limit}`, {
    token,
    cache: 'no-store',
  });
}
