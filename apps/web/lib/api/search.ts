import { apiFetch } from './client';
import type { AutocompleteSuggestion, SearchResult } from './types';

/**
 * The search module — `DOM-SEARCH`, and `FR-3`'s typo-tolerant search with
 * autosuggest.
 *
 * The storefront has been calling `/products?q=` all along, whose own DTO
 * describes that path as *"Postgres trigram fallback — Elasticsearch is the
 * primary search path"* (KC-116). The capability was built and the UI reached
 * around it.
 *
 * **The client never decides whether Elasticsearch is up.** `/search` degrades
 * to the same Postgres path server-side when it is unreachable (`DOM-SEARCH`
 * property 2), which is the only place that can know — and it keeps the
 * fallback a live path rather than dead code, which KC-124 requires.
 */

export interface SearchParams {
  q: string;
  page?: number;
  pageSize?: number;
  category?: string;
  metal?: string;
}

export function searchProducts(params: SearchParams, cacheable = true) {
  const query = new URLSearchParams({ q: params.q });
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.category) query.set('category', params.category);
  if (params.metal) query.set('metal', params.metal);

  return apiFetch<SearchResult>(`/search?${query}`, cacheable ? {} : { cache: 'no-store' });
}

/**
 * Suggestions as someone types. Deliberately tiny — product id, slug and name —
 * because a suggestion list is a way to *get somewhere*, not a results page in
 * miniature.
 */
export function autocomplete(q: string, limit = 6) {
  return apiFetch<AutocompleteSuggestion[]>(
    `/search/autocomplete?q=${encodeURIComponent(q)}&limit=${limit}`,
    { cache: 'no-store' },
  );
}
