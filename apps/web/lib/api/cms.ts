import { apiFetch } from './client';
import type { ActiveBanner, Announcement } from './types';

/**
 * Public banner feed. Revalidated rather than fetched per request: a banner is
 * scheduled content that changes on the order of days, and the homepage is the
 * most-hit page on the site.
 *
 * The window is short enough that `startsAt`/`endsAt` still land near their
 * scheduled minute — the API filters on those, so a stale cache entry is the
 * only thing that can show an expired banner.
 */
export function getActiveBanners(revalidate = 60) {
  return apiFetch<ActiveBanner[]>('/cms/banners', { revalidate });
}

/** Degrades to no banners (not a crash) if the API is unreachable — same
 *  contract as safeGetProducts, which the rest of the homepage already uses. */
export async function safeGetActiveBanners(): Promise<ActiveBanner[]> {
  try {
    return await getActiveBanners();
  } catch {
    return [];
  }
}

/**
 * The site-wide announcement strip (admin-editable via `announcement.text` /
 * `announcement.active`, FEAT-SETTINGS-STORE). Same short revalidation window
 * as the banner feed — it changes on the order of days, not per request, but
 * shouldn't need a redeploy to update.
 */
export function getAnnouncement(revalidate = 60) {
  return apiFetch<Announcement | null>('/cms/announcement', { revalidate });
}

/** Degrades to no announcement (not a crash) if the API is unreachable —
 *  same contract as safeGetActiveBanners. */
export async function safeGetAnnouncement(): Promise<Announcement | null> {
  try {
    return await getAnnouncement();
  } catch {
    return null;
  }
}
