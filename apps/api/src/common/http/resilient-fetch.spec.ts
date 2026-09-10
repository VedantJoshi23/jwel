import {
  isRetryableStatus,
  parseRetryAfter,
  ResilientFetchError,
  resilientFetch,
} from './resilient-fetch';

/**
 * Real timers throughout. The backoffs here are single-digit milliseconds, so
 * the suite stays fast without fake timers — and fake timers would not
 * exercise `AbortSignal.timeout`, which is the behaviour most worth proving.
 */

describe('resilientFetch', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    // Full jitter multiplies by Math.random(); pinning it makes the delays
    // deterministic without changing which branch runs.
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const ok = (status = 200, headers: Record<string, string> = {}) =>
    new Response('{}', { status, headers });

  describe('what it retries', () => {
    it('retries a GET on a transient 503 and returns the eventual success', async () => {
      fetchMock.mockResolvedValueOnce(ok(503)).mockResolvedValueOnce(ok(200));

      const response = await resilientFetch('https://vendor.test/x', { backoffMs: 1 });

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries a network error and succeeds on the next attempt', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(ok(200));

      const response = await resilientFetch('https://vendor.test/x', { backoffMs: 1 });

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('makes at most retries+1 attempts, then throws', async () => {
      fetchMock.mockRejectedValue(new TypeError('network'));

      await expect(
        resilientFetch('https://vendor.test/x', { retries: 2, backoffMs: 1 }),
      ).rejects.toBeInstanceOf(ResilientFetchError);

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('what it refuses to retry', () => {
    it.each([400, 401, 403, 404, 409, 422])('does not retry a %i', async (status) => {
      fetchMock.mockResolvedValue(ok(status));

      const response = await resilientFetch('https://vendor.test/x', { backoffMs: 1 });

      expect(response.status).toBe(status);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry a POST by default, even on a 503', async () => {
      fetchMock.mockResolvedValue(ok(503));

      const response = await resilientFetch('https://vendor.test/x', {
        method: 'POST',
        backoffMs: 1,
      });

      expect(response.status).toBe(503);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries a POST only when it is declared idempotent', async () => {
      fetchMock.mockResolvedValueOnce(ok(503)).mockResolvedValueOnce(ok(200));

      const response = await resilientFetch('https://vendor.test/x', {
        method: 'POST',
        idempotent: true,
        backoffMs: 1,
      });

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry when the caller aborts', async () => {
      const controller = new AbortController();
      fetchMock.mockImplementation(() => {
        controller.abort();
        return Promise.reject(new DOMException('aborted', 'AbortError'));
      });

      await expect(
        resilientFetch('https://vendor.test/x', { signal: controller.signal, backoffMs: 1 }),
      ).rejects.toThrow(/abort/i);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry-After', () => {
    it('waits the header value in preference to computed backoff', async () => {
      fetchMock
        .mockResolvedValueOnce(ok(429, { 'retry-after': '0.05' }))
        .mockResolvedValueOnce(ok(200));

      const started = Date.now();
      const response = await resilientFetch('https://vendor.test/x', { backoffMs: 1 });

      expect(response.status).toBe(200);
      // 50ms from the header, far above the 1ms backoff it overrode.
      expect(Date.now() - started).toBeGreaterThanOrEqual(45);
    });

    it('returns the response rather than waiting past the total budget', async () => {
      fetchMock.mockResolvedValue(ok(429, { 'retry-after': '600' }));

      const response = await resilientFetch('https://vendor.test/x', { maxTotalMs: 200 });

      expect(response.status).toBe(429);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('timeouts and the total budget', () => {
    it('aborts an attempt that exceeds the per-attempt timeout', async () => {
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('timed out', 'TimeoutError')),
            );
          }),
      );

      const started = Date.now();
      await expect(
        resilientFetch('https://vendor.test/x', { timeoutMs: 40, retries: 0 }),
      ).rejects.toBeInstanceOf(ResilientFetchError);

      expect(Date.now() - started).toBeLessThan(1000);
    });

    it('stops once the total budget is exhausted, regardless of retries left', async () => {
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('timed out', 'TimeoutError')),
            );
          }),
      );

      const started = Date.now();
      await expect(
        resilientFetch('https://vendor.test/x', {
          timeoutMs: 50,
          retries: 20,
          maxTotalMs: 150,
          backoffMs: 1,
        }),
      ).rejects.toBeInstanceOf(ResilientFetchError);

      const elapsed = Date.now() - started;
      // 20 retries at 50ms each would be a second; the budget caps it.
      expect(elapsed).toBeLessThan(600);
      expect(fetchMock.mock.calls.length).toBeLessThan(20);
    });
  });
});

describe('isRetryableStatus', () => {
  it.each([408, 429, 500, 502, 503, 504])('treats %i as retryable', (status) => {
    expect(isRetryableStatus(status)).toBe(true);
  });

  it.each([200, 201, 301, 400, 401, 403, 404, 409, 418, 422])(
    'treats %i as final',
    (status) => {
      expect(isRetryableStatus(status)).toBe(false);
    },
  );
});

describe('parseRetryAfter', () => {
  const now = Date.parse('2026-09-10T12:00:00Z');

  it('reads delay-seconds', () => {
    expect(parseRetryAfter('120', now)).toBe(120_000);
  });

  it('reads an HTTP-date as a delta from now', () => {
    expect(parseRetryAfter('Thu, 10 Sep 2026 12:00:30 GMT', now)).toBe(30_000);
  });

  it('clamps a past HTTP-date to zero rather than returning a negative delay', () => {
    expect(parseRetryAfter('Thu, 10 Sep 2026 11:59:00 GMT', now)).toBe(0);
  });

  it('ignores a missing or unparseable header', () => {
    expect(parseRetryAfter(null, now)).toBeUndefined();
    expect(parseRetryAfter('soon', now)).toBeUndefined();
  });

  it('ignores a negative delay-seconds', () => {
    expect(parseRetryAfter('-5', now)).toBeUndefined();
  });
});
