import { apiFetch, ApiError } from './client';
import type { Collection, CollectionWithProducts } from './types';

export function getCollections(revalidate = 60) {
  return apiFetch<Collection[]>('/collections', { revalidate });
}

/**
 * Resolves a slug against the Collection model.
 *
 * Returns `null` for "this slug is not a live collection", which is the
 * ordinary case: every category URL on the storefront hits this first and
 * comes back null so the page can fall through to its category behaviour.
 *
 * A 404 is therefore mapped to `null` rather than propagated, but any other
 * failure — a 500, an unreachable API — is deliberately left to throw. Those
 * mean "we don't know whether this is a collection", and silently falling
 * back would render a category page for a URL that may well be a collection,
 * which is worse than an error.
 */
export async function getCollectionBySlug(
  slug: string,
  page = 1,
  pageSize = 12,
  revalidate = 60,
): Promise<CollectionWithProducts | null> {
  try {
    return await apiFetch<CollectionWithProducts>(
      `/collections/${encodeURIComponent(slug)}?page=${page}&pageSize=${pageSize}`,
      { revalidate },
    );
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) return null;
    throw error;
  }
}

/**
 * The same lookup, but tolerant of the API being down.
 *
 * The storefront's collection route uses this rather than the strict version:
 * the category path below it already degrades to an empty product list rather
 * than erroring (it has its own try/catch), so letting a collection lookup
 * take the whole page down would make /collections/rings *less* resilient
 * than it is today. Reserved for that one caller — anything that needs to
 * distinguish "not a collection" from "couldn't tell" should use the strict
 * version above.
 */
export async function safeGetCollectionBySlug(
  slug: string,
  page = 1,
  pageSize = 12,
): Promise<CollectionWithProducts | null> {
  try {
    return await getCollectionBySlug(slug, page, pageSize);
  } catch {
    return null;
  }
}
