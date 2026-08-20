import type { ApiErrorEnvelope } from './types';
import { useAuthStore } from '../auth-store';

/**
 * An explicit `NEXT_PUBLIC_API_URL` always wins — that's how a real
 * deployment points at its own API. Only the bare local-dev fallback differs
 * by side: server-side code (SSR data fetching) runs inside the same Node
 * process the API is reachable from, so `localhost:4000` is genuinely correct
 * there. Client-side code runs in whatever browser loaded the page, which on
 * a forwarded remote dev server is a *different machine* — `localhost:4000`
 * there means the visitor's own laptop, not the API. The relative `/api/v1`
 * fallback instead resolves against whatever origin the browser actually
 * used, and `next.config.mjs`'s `devApiRewrites()` proxies it server-side to
 * the real API — see the comment there for the full reasoning.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window === 'undefined' ? 'http://localhost:4000/api/v1' : '/api/v1');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiFetchOptions extends RequestInit {
  token?: string;
  /** Server Components can opt into Next.js's fetch cache; client-side calls should not. */
  revalidate?: number | false;
}

/**
 * A 401 on a request that carried a bearer token means the *session* is no
 * longer valid — expired (the API issues a flat 12h JWT, no refresh token
 * exists in this app) or otherwise invalidated server-side — not that this
 * one endpoint refused the caller. Every authenticated request goes through
 * `apiFetch`/`apiUpload`, so handling it once here means every page
 * recovers the same way, rather than each page either not noticing (the
 * admin shell rendering as if signed in, with each panel independently
 * failing) or handling it inconsistently.
 *
 * A 401 with no token attached is a different, ordinary thing — an
 * anonymous request the API correctly refused — and must not trigger this.
 */
function handleExpiredSession(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/login')) return;
  useAuthStore.getState().logout();
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?next=${next}&sessionExpired=1`;
}

async function handleResponse<T>(response: Response, hadToken: boolean): Promise<T> {
  if (!response.ok) {
    if (response.status === 401 && hadToken) {
      handleExpiredSession();
    }

    let envelope: ApiErrorEnvelope | undefined;
    try {
      envelope = await response.json();
    } catch {
      // Backend's AllExceptionsFilter always returns the JSON envelope — a
      // parse failure here means the API is unreachable, not a 4xx/5xx body.
    }
    const message = Array.isArray(envelope?.message)
      ? envelope.message.join(', ')
      : envelope?.message ?? response.statusText;
    throw new ApiError(message, response.status, envelope?.correlationId);
  }

  // Not just a `204` check: several endpoints return `void` from their
  // service and NestJS still ships that as a 200/201 with an empty body —
  // `response.json()` on an empty string throws a SyntaxError, which
  // propagated out of here as if the request had failed. A caller
  // (`QnaUpvoteButton`, `adminDeleteBanner`, and every other `apiFetch<void>`
  // site) would show its generic error toast on a request that had actually
  // succeeded server-side. Reading the body as text first and only parsing
  // it when there's something there covers both cases without needing every
  // void-returning route to remember to opt into `@HttpCode(204)`.
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, revalidate, headers, ...rest } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(revalidate !== undefined ? { next: { revalidate } } : {}),
  });

  return handleResponse<T>(response, Boolean(token));
}

/**
 * Separate from `apiFetch` rather than a special-cased branch inside it —
 * a multipart upload must NOT set `Content-Type` itself (the browser sets
 * it, including the multipart boundary, only when it sees a `FormData` body
 * untouched by a manual header), which is the opposite of `apiFetch`'s
 * always-JSON default.
 */
export async function apiUpload<T>(path: string, formData: FormData, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  return handleResponse<T>(response, Boolean(token));
}

/**
 * A binary (non-JSON) download — `handleResponse` assumes a JSON body, which
 * a PDF is not, so this stays a separate path rather than a branch inside
 * `apiFetch`. Error responses are still JSON (`AllExceptionsFilter`), so
 * those go through the same envelope parsing on failure.
 */
export async function apiDownload(path: string, token?: string): Promise<Blob> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    if (response.status === 401 && token) {
      handleExpiredSession();
    }
    let envelope: ApiErrorEnvelope | undefined;
    try {
      envelope = await response.json();
    } catch {
      // Same reasoning as handleResponse: a parse failure here means the API
      // is unreachable, not a 4xx/5xx body.
    }
    const message = Array.isArray(envelope?.message)
      ? envelope.message.join(', ')
      : (envelope?.message ?? response.statusText);
    throw new ApiError(message, response.status, envelope?.correlationId);
  }

  return response.blob();
}

/** Triggers a browser save-as for a Blob without navigating away from the page. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
