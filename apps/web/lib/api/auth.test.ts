import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login, register } from './auth';

function ok(body: unknown = {}) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('auth API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok()));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('login POSTs email/password to /auth/login', async () => {
    await login('a@b.com', 'pw');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/auth/login');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.com', password: 'pw' });
  });

  it('register POSTs all provided fields to /auth/register', async () => {
    await register('a@b.com', 'pw', 'Name', '+91123');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/auth/register');
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.com', password: 'pw', name: 'Name', phone: '+91123' });
  });
});
