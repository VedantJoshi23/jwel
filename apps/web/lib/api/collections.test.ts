import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCollectionBySlug, getCollections, safeGetCollectionBySlug } from './collections';

function respond(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

describe('getCollections', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the public collections feed', async () => {
    respond([]);
    await getCollections();
    expect((fetch as any).mock.calls[0][0]).toContain('/collections');
  });
});

describe('getCollectionBySlug', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('passes pagination through', async () => {
    respond({ id: 'c1' });
    await getCollectionBySlug('diwali-edit', 2, 24);
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('page=2');
    expect(url).toContain('pageSize=24');
  });

  it('encodes the slug', async () => {
    respond({ id: 'c1' });
    await getCollectionBySlug('a b/c');
    expect((fetch as any).mock.calls[0][0]).toContain('a%20b%2Fc');
  });

  // "Not a collection" is the ordinary case — every category URL on the site
  // produces it, and the route falls through to its category behaviour.
  it('maps a 404 to null rather than throwing', async () => {
    respond({ message: 'Collection not found' }, 404);
    await expect(getCollectionBySlug('rings')).resolves.toBeNull();
  });

  // A 500 means "we don't know whether this is a collection". Falling back
  // silently would render a category page for a URL that may well be one.
  it.each([500, 502, 400])('propagates a %s rather than swallowing it', async (status) => {
    respond({ message: 'boom' }, status);
    await expect(getCollectionBySlug('diwali-edit')).rejects.toThrow();
  });

  it('propagates a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(getCollectionBySlug('diwali-edit')).rejects.toThrow('ECONNREFUSED');
  });

  it('returns the collection when one matches', async () => {
    respond({ id: 'c1', slug: 'diwali-edit', products: { items: [], page: 1, pageSize: 12, total: 0 } });
    await expect(getCollectionBySlug('diwali-edit')).resolves.toMatchObject({ slug: 'diwali-edit' });
  });
});

describe('safeGetCollectionBySlug', () => {
  afterEach(() => vi.unstubAllGlobals());

  // The category path below it already degrades to an empty list rather than
  // erroring, so a failed collection lookup must not make /collections/rings
  // *less* resilient than it is today.
  it('returns null when the API is unreachable, instead of taking the page down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(safeGetCollectionBySlug('rings')).resolves.toBeNull();
  });

  it('returns null on a 500', async () => {
    respond({ message: 'boom' }, 500);
    await expect(safeGetCollectionBySlug('rings')).resolves.toBeNull();
  });

  it('still returns a real collection when one matches', async () => {
    respond({ id: 'c1', slug: 'diwali-edit' });
    await expect(safeGetCollectionBySlug('diwali-edit')).resolves.toMatchObject({ id: 'c1' });
  });
});
