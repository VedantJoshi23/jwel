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
