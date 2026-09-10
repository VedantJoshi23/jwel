/**
 * Outbound HTTP with a bounded worst case.
 *
 * Every outbound call in this service previously used a bare `fetch` with no
 * timeout, so a vendor that accepted a connection and then stalled would hold
 * the caller indefinitely — Node's global fetch has no default timeout.
 *
 * The retry policy is deliberately narrow. A blind retry on a payment capture
 * or a notification send is worse than a failure, because the caller cannot
 * tell one delivery from three. So retries are opt-in by method, restricted to
 * failures that are plausibly transient, and bounded in total duration rather
 * than only in count.
 */

export interface ResilientFetchOptions extends RequestInit {
  /** Per-attempt timeout. The total is bounded separately by `maxTotalMs`. */
  timeoutMs?: number;
  /** Attempts after the first. Zero disables retrying. */
  retries?: number;
  /** Ceiling across all attempts including backoff, measured from the first call. */
  maxTotalMs?: number;
  /**
   * Declares this call safe to repeat. Required to retry anything other than
   * GET/HEAD: set it only when the endpoint is genuinely idempotent or the
   * request carries an idempotency key.
   */
  idempotent?: boolean;
  /** Base for exponential backoff; the delay is this << (attempt - 1), plus jitter. */
  backoffMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_MAX_TOTAL_MS = 20_000;
const DEFAULT_BACKOFF_MS = 250;

/** Thrown when every attempt failed without producing a response. */
export class ResilientFetchError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
    readonly lastError?: unknown,
  ) {
    super(message);
    this.name = 'ResilientFetchError';
  }
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * A 4xx means the request was understood and rejected — repeating it produces
 * the same rejection. The exceptions are 408 (the server itself calls it a
 * timeout) and 429, which explicitly invites a later retry.
 */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

/**
 * `Retry-After` is the vendor telling us how long to wait; it outranks any
 * backoff we compute. Both RFC forms are accepted — delay-seconds, and an
 * HTTP-date, which some gateways use for 429s.
 */
export function parseRetryAfter(header: string | null, now: number = Date.now()): number | undefined {
  if (!header) return undefined;

  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return seconds >= 0 ? seconds * 1000 : undefined;
  }

  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  const delta = date - now;
  return delta > 0 ? delta : 0;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    maxTotalMs = DEFAULT_MAX_TOTAL_MS,
    backoffMs = DEFAULT_BACKOFF_MS,
    idempotent,
    signal,
    ...init
  } = options;

  const method = (init.method ?? 'GET').toUpperCase();
  // GET and HEAD are idempotent by definition; anything else has to say so.
  const mayRetry = idempotent ?? (method === 'GET' || method === 'HEAD');
  const maxAttempts = mayRetry ? retries + 1 : 1;

  const startedAt = Date.now();
  const remaining = (): number => maxTotalMs - (Date.now() - startedAt);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Never let one attempt's timeout push us past the total budget.
    const attemptTimeout = Math.min(timeoutMs, Math.max(remaining(), 0));
    if (attemptTimeout <= 0) {
      throw new ResilientFetchError(
        `resilientFetch: total budget of ${maxTotalMs}ms exhausted after ${attempt - 1} attempt(s) to ${url}`,
        attempt - 1,
        lastError,
      );
    }

    const timeoutSignal = AbortSignal.timeout(attemptTimeout);
    // A caller-supplied signal must still win, so both are honoured.
    const composed = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

    try {
      const response = await fetch(url, { ...init, signal: composed });

      if (attempt < maxAttempts && isRetryableStatus(response.status)) {
        const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
        const delay = retryAfter ?? backoff(backoffMs, attempt);
        if (delay >= remaining()) return response;
        await sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      // An abort from the caller's own signal is a cancellation, not a
      // transient failure — retrying it would ignore the caller.
      if (signal?.aborted) throw error;

      if (attempt >= maxAttempts) break;

      const delay = backoff(backoffMs, attempt);
      if (delay >= remaining()) break;
      await sleep(delay);
    }
  }

  throw new ResilientFetchError(
    `resilientFetch: ${maxAttempts} attempt(s) to ${url} failed`,
    maxAttempts,
    lastError,
  );
}

/**
 * Full jitter. Without it, several callers failing on the same vendor blip
 * retry in lockstep and arrive together, which is the thundering herd the
 * backoff was supposed to prevent.
 */
function backoff(base: number, attempt: number): number {
  const ceiling = base * 2 ** (attempt - 1);
  return Math.round(Math.random() * ceiling);
}
