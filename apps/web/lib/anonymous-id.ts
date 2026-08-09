const STORAGE_KEY = 'jwel-anonymous-id';

/**
 * A browser-local identifier for view tracking.
 *
 * `DOM-RECOMMENDATION` Invariant 3: this is **client-generated and never a real
 * identity**, and must not be joinable to a person. So it is a random value
 * with nothing derived from the device, the account or anything else — the
 * only thing it can ever answer is "were these views the same browser".
 *
 * Kept in `localStorage` rather than a cookie deliberately: a cookie would be
 * sent to the API on every request, quietly turning an analytics key into
 * something that travels with authenticated calls too.
 *
 * Returns null during server rendering, where there is no browser to identify —
 * callers treat that as "no view to record", which Invariant 2 already allows.
 */
export function getAnonymousId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const created = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // Storage can be unavailable — private browsing, a blocked origin, a full
    // quota. View tracking is best-effort telemetry and must never be the
    // reason a product page fails to render.
    return null;
  }
}
