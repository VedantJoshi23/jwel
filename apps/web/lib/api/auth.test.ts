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
    expect(JSON.parse(options.body)).toMatchObject({
      email: 'a@b.com',
      password: 'pw',
      name: 'Name',
      phone: '+91123',
    });
  });

  /**
   * DOM-RECOMMENDATION Invariant 9 — the browser's guest view history has to
   * reach the server at sign-up or it is lost. Read inside `register` rather
   * than passed in, because a form that has to remember to pass it is a form
   * that will eventually forget.
   */
  it('register carries this browser’s guest view id', async () => {
    await register('a@b.com', 'pw');
    const [, options] = (fetch as any).mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.anonymousId).toEqual(expect.any(String));
    expect(body.anonymousId).toBe(window.localStorage.getItem('jwel-anonymous-id'));
  });

  it('register still works when the browser has no id to send', async () => {
    // Private browsing, a blocked origin, a full quota — none of which should
    // stop someone creating an account.
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => { throw new Error('denied'); });
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => { throw new Error('denied'); });

    await register('a@b.com', 'pw');
    const [, options] = (fetch as any).mock.calls[0];

    expect(JSON.parse(options.body).anonymousId).toBeUndefined();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
