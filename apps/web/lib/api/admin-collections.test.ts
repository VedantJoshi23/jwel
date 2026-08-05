import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminCreateCollection,
  adminDeleteCollection,
  adminListCollections,
  adminUpdateCollection,
} from './admin-collections';

describe('admin collections client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists from the admin endpoint with no caching', async () => {
    await adminListCollections('token-1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/collections');
    expect(options.cache).toBe('no-store');
  });

  it('creates via POST', async () => {
    await adminCreateCollection('token-1', { name: 'Diwali Edit', type: 'SEASONAL' });
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ name: 'Diwali Edit', type: 'SEASONAL' });
  });

  // PUT, not PATCH: the API treats the body as the full desired state, and
  // productIds replaces membership wholesale rather than merging.
  it('updates via PUT at the collection id', async () => {
    await adminUpdateCollection('token-1', 'c1', { name: 'Diwali Edit', type: 'SEASONAL' });
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/collections/c1');
    expect(options.method).toBe('PUT');
  });

  it('passes productIds through when replacing membership', async () => {
    await adminUpdateCollection('token-1', 'c1', {
      name: 'Diwali Edit',
      type: 'SEASONAL',
      productIds: ['p1', 'p2'],
    });
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body).productIds).toEqual(['p1', 'p2']);
  });

  it('deletes via DELETE at the collection id', async () => {
    await adminDeleteCollection('token-1', 'c1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/collections/c1');
    expect(options.method).toBe('DELETE');
  });

  it('sends the bearer token on every call', async () => {
    await adminListCollections('token-1');
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer token-1');
  });
});
