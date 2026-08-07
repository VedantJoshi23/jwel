import { apiFetch } from './client';
import type { SizeOption, SizeScheme } from './types';

/**
 * FEAT-SIZE-TAXONOMY — the seeded size vocabulary.
 *
 * Read-only by design: sizes are reference data, and letting a client invent
 * one is how the free-text vocabulary this feature replaces came about.
 */
export function getSizes(scheme?: SizeScheme, revalidate = 3600): Promise<SizeOption[]> {
  // Cached for an hour rather than per-request: this is seeded data that
  // changes only when someone runs a seed script, and both the collection
  // filter and every PDP read it.
  const query = scheme ? `?scheme=${encodeURIComponent(scheme)}` : '';
  return apiFetch<SizeOption[]>(`/sizes${query}`, { revalidate });
}

/**
 * Fetches sizes for a scheme, returning [] rather than throwing.
 *
 * The size filter is an enhancement to a category listing — if the API is
 * unreachable the listing must still render, just without the filter. Same
 * posture as `safeGetProducts`.
 */
export async function safeGetSizes(scheme?: SizeScheme | null): Promise<SizeOption[]> {
  if (!scheme || scheme === 'NONE') return [];
  try {
    return await getSizes(scheme);
  } catch {
    return [];
  }
}
