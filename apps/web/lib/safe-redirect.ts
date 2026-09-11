const SAME_ORIGIN = 'http://same-origin.invalid';

/**
 * Turns an untrusted `?next=` value into a path on this site, or the fallback.
 *
 * The login page used to pass `next` straight to `router.push`. Next's router
 * treats a cross-origin target as a full browser navigation — its RSC fetch
 * fails, it logs "Falling back to browser navigation", and calls
 * `location.assign(url)` — so `/login?next=https://phishing.example` sent a
 * customer who had just typed their real password somewhere else entirely.
 * The same path would hand a `javascript:` URL to `location.assign`, and
 * nothing in Next 15.5's client blocks that scheme.
 *
 * Only a same-site path survives: exactly one leading slash, resolving to our
 * own origin. The origin check after parsing is what catches the forms that
 * look like paths but are not — "//evil.example" and "/\evil.example" are both
 * protocol-relative to a browser, and the URL parser strips tabs and newlines,
 * so "/\t/evil.example" becomes "//evil.example".
 */
export function safeRedirectPath(next: string | null | undefined, fallback = '/profile'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(next, SAME_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== SAME_ORIGIN) return fallback;

  // Returning to the login page after logging in would just show it again.
  if (url.pathname === '/login' || url.pathname.startsWith('/login/')) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
