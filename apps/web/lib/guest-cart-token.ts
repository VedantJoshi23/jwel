const STORAGE_KEY = 'jwel-guest-cart';

/**
 * The token that identifies a guest's cart on the server.
 *
 * `DOM-SHOPPING` Invariant 5: a cart belongs to **either** a registered user
 * **or** a guest session. This is the guest half — a random value this browser
 * keeps, sent as `x-guest-cart-token`.
 *
 * It is a **bearer credential**, unlike `jwel-anonymous-id` next door: anyone
 * holding it can read and edit that cart. It is not an identity and is never
 * joined to a person, but it is not merely analytics either, which is why the
 * API refuses to honour it alongside a login.
 *
 * Created lazily — a visitor who never adds anything never gets one, and so
 * never causes a cart row to exist.
 */
export function getGuestCartToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Returns the existing token, creating one if this browser has none. */
export function ensureGuestCartToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // Storage unavailable — private browsing, blocked origin, full quota. The
    // caller falls back to no cart rather than a broken one.
    return null;
  }
}

/**
 * Called once the guest cart has been handed to an account. Keeping it would
 * leave a stale token that now points at a deleted cart, and would be offered
 * again on the next sign-in.
 */
export function clearGuestCartToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — if it cannot be read it cannot be sent either.
  }
}
