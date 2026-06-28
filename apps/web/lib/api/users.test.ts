import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addAddress, getProfile, listAddresses, removeAddress, updateProfile } from './users';

describe('users API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('getProfile GETs /me with the auth token', async () => {
    await getProfile('token-1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/me');
    expect(options.headers.Authorization).toBe('Bearer token-1');
  });

  it('updateProfile PATCHes /me with the given fields', async () => {
    await updateProfile('token-1', { name: 'New Name' });
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ name: 'New Name' });
  });

  it('listAddresses GETs /me/addresses', async () => {
    await listAddresses('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/me/addresses');
  });

  it('addAddress POSTs the new address', async () => {
    const address = { line1: 'x', city: 'y', state: 'z', pincode: '1', country: 'IN', isDefault: false, label: null, line2: null };
    await addAddress('token-1', address as any);
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.method).toBe('POST');
  });

  it('removeAddress DELETEs the address by id', async () => {
    await removeAddress('token-1', 'a1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/me/addresses/a1');
    expect(options.method).toBe('DELETE');
  });
});
