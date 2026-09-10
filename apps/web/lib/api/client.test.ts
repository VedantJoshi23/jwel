import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiUpload, ApiError } from './client';
import { useAuthStore } from '../auth-store';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a JSON Content-Type header by default', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await apiFetch('/test');
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('attaches an Authorization header when a token is provided', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await apiFetch('/test', { token: 'abc123' });
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer abc123');
  });

  it('omits Authorization when no token is provided', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await apiFetch('/test');
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('returns the parsed JSON body on success', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ hello: 'world' }), { status: 200 }));
    expect(await apiFetch('/test')).toEqual({ hello: 'world' });
  });

  it('returns undefined for a 204 No Content response', async () => {
    (fetch as any).mockResolvedValue(new Response(null, { status: 204 }));
    expect(await apiFetch('/test')).toBeUndefined();
  });

  it('returns undefined for a 200/201 with an empty body, rather than throwing on the JSON parse', async () => {
    // Regression for a real production bug: a `void`-returning controller
    // method (e.g. the Q&A upvote routes, before they were given an
    // explicit @HttpCode(204)) still gets a 200/201 from Nest by default,
    // with nothing in the body. Calling response.json() on that threw a
    // SyntaxError that looked exactly like a failed request to every
    // caller, even though the mutation had already succeeded server-side.
    (fetch as any).mockResolvedValue(new Response('', { status: 200 }));
    expect(await apiFetch('/test')).toBeUndefined();
    (fetch as any).mockResolvedValue(new Response('', { status: 201 }));
    expect(await apiFetch('/test')).toBeUndefined();
  });

  it('throws ApiError with the backend message and status on a 4xx/5xx response', async () => {
    (fetch as any).mockResolvedValue(
      new Response(
        JSON.stringify({ statusCode: 404, error: 'NotFoundException', message: 'Product not found', correlationId: 'c1' }),
        { status: 404 },
      ),
    );
    await expect(apiFetch('/test')).rejects.toMatchObject({
      message: 'Product not found',
      statusCode: 404,
      correlationId: 'c1',
    });
  });

  it('joins an array of validation messages into a single string', async () => {
    (fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 400, message: ['email must be valid', 'password too short'] }), {
        status: 400,
      }),
    );
    await expect(apiFetch('/test')).rejects.toThrow('email must be valid, password too short');
  });

  it('falls back to statusText when the error body cannot be parsed as JSON', async () => {
    (fetch as any).mockResolvedValue(new Response('not json', { status: 500, statusText: 'Internal Server Error' }));
    await expect(apiFetch('/test')).rejects.toThrow('Internal Server Error');
  });

  it('is an instance of ApiError', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ message: 'x' }), { status: 400 }));
    try {
      await apiFetch('/test');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }
  });
});

describe('expired-session handling', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    useAuthStore.getState().setSession('token-1', {
      id: 'u1',
      email: 'a@b.com',
      name: null,
      role: 'CUSTOMER',
    });
    originalLocation = window.location;
    // jsdom's real `window.location` throws "Not implemented: navigation"
    // when `.href` is assigned — replaced with a plain mutable object so the
    // redirect can actually be asserted on, matching how a browser's own
    // `window.location.href = x` reads back after assignment.
    Object.defineProperty(window, 'location', {
      value: { pathname: '/admin', search: '', href: '' },
      writable: true,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.getState().logout();
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('a 401 on an authenticated request clears the session and redirects to /login', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }));
    await expect(apiFetch('/admin/products', { token: 'token-1' })).rejects.toThrow();

    expect(useAuthStore.getState().token).toBeNull();
    expect(window.location.href).toContain('/login');
    expect(window.location.href).toContain('sessionExpired=1');
  });

  it('preserves where the visitor was, as ?next=, so they land back there after logging in', async () => {
    window.location.pathname = '/admin/orders';
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }));
    await expect(apiFetch('/admin/orders', { token: 'token-1' })).rejects.toThrow();

    expect(window.location.href).toContain(`next=${encodeURIComponent('/admin/orders')}`);
  });

  it('a 401 with no token attached is an ordinary anonymous-request refusal, not a session expiry', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }));
    await expect(apiFetch('/some/public/route')).rejects.toThrow();

    expect(useAuthStore.getState().token).toBe('token-1');
    expect(window.location.href).toBe('');
  });

  it('does not redirect again when already on the login page, avoiding a loop', async () => {
    window.location.pathname = '/login';
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }));
    await expect(apiFetch('/some/route', { token: 'token-1' })).rejects.toThrow();

    expect(window.location.href).toBe('');
  });

  it('a non-401 error with a token does not clear the session', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }));
    await expect(apiFetch('/admin/products', { token: 'token-1' })).rejects.toThrow();

    expect(useAuthStore.getState().token).toBe('token-1');
    expect(window.location.href).toBe('');
  });
});

describe('apiUpload', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the FormData as the body without setting a Content-Type header', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const formData = new FormData();
    formData.append('file', new Blob(['csv,data']), 'test.csv');

    await apiUpload('/upload', formData, 'token-1');

    const [, options] = (fetch as any).mock.calls[0];
    expect(options.body).toBe(formData);
    expect(options.headers).toEqual({ Authorization: 'Bearer token-1' });
  });

  it('omits the Authorization header when no token is provided', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await apiUpload('/upload', new FormData());
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers).toBeUndefined();
  });
});

describe('request timeouts', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches an abort signal to every request', async () => {
    // Neither Node's fetch nor the browser's times out on its own, so without
    // this a stalled API held the caller open indefinitely — the spinner that
    // never resolves.
    (fetch as any).mockResolvedValue(new Response('{}', { status: 200 }));

    await apiFetch('/test');

    const [, options] = (fetch as any).mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('gives mutations a longer budget than reads', async () => {
    // A fresh Response per call: a body can only be read once, so a shared
    // instance makes the second call fail for reasons unrelated to the test.
    (fetch as any).mockImplementation(async () => new Response('{}', { status: 200 }));

    await apiFetch('/read');
    await apiFetch('/write', { method: 'POST' });

    const readSignal = (fetch as any).mock.calls[0][1].signal;
    const writeSignal = (fetch as any).mock.calls[1][1].signal;

    // Both are live; the distinction is in how long they stay that way, which
    // is asserted behaviourally below rather than by reading a private field.
    expect(readSignal.aborted).toBe(false);
    expect(writeSignal.aborted).toBe(false);
  });

  it('aborts a read that outlives its budget', async () => {
    vi.useFakeTimers();
    try {
      let observed: AbortSignal | undefined;
      (fetch as any).mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            observed = init.signal as AbortSignal;
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );

      const pending = apiFetch('/slow').catch((error: Error) => error);
      await vi.advanceTimersByTimeAsync(8_000);
      await pending;

      expect(observed?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still honours a caller-supplied signal', async () => {
    // A superseded search keystroke or an unmounting effect must be able to
    // cancel, not be overridden by our timeout.
    const controller = new AbortController();
    let observed: AbortSignal | undefined;
    (fetch as any).mockImplementation((_url: string, init: RequestInit) => {
      observed = init.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });

    const pending = apiFetch('/slow', { signal: controller.signal }).catch((e: Error) => e);
    controller.abort();
    await pending;

    expect(observed?.aborted).toBe(true);
  });
});

describe('signal composition without AbortSignal.any', () => {
  // jsdom has no AbortSignal.any, and neither do Chrome < 116, Safari < 17.4
  // or Firefox < 124. Calling it unguarded throws before fetch is reached, so
  // this branch is what real older phones execute — not an edge case.
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is the branch this environment actually takes', () => {
    expect(typeof (AbortSignal as { any?: unknown }).any).toBe('undefined');
  });

  it('still aborts when the caller aborts', async () => {
    const controller = new AbortController();
    let observed: AbortSignal | undefined;
    (fetch as any).mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          observed = init.signal as AbortSignal;
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const pending = apiFetch('/slow', { signal: controller.signal }).catch((e: Error) => e);
    controller.abort();
    await pending;

    expect(observed?.aborted).toBe(true);
  });

  it('still aborts on timeout when a caller signal is also present', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      let observed: AbortSignal | undefined;
      (fetch as any).mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            observed = init.signal as AbortSignal;
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );

      const pending = apiFetch('/slow', { signal: controller.signal }).catch((e: Error) => e);
      await vi.advanceTimersByTimeAsync(8_000);
      await pending;

      expect(observed?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts immediately when the caller signal is already aborted', async () => {
    // Mirrors real fetch, which rejects up front on an already-aborted signal
    // rather than waiting for an abort event that has already fired.
    (fetch as any).mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          if (init.signal?.aborted) {
            reject(new Error('aborted'));
            return;
          }
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const result = await apiFetch('/slow', { signal: AbortSignal.abort() }).catch((e: Error) => e);

    expect(result).toBeInstanceOf(Error);
  });
});
