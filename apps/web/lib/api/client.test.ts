import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiUpload, ApiError } from './client';

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
