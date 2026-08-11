import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProducts, getProductBySlug, getProductReviews, getMyReview } from './products';

describe('getProducts query string building', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, pageSize: 24, total: 0 }), { status: 200 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('omits undefined fields from the query string', async () => {
    await getProducts({ category: 'rings' });
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('category=rings');
    expect(url).not.toContain('metal=');
    expect(url).not.toContain('priceMin=');
  });

  it('omits empty-string fields from the query string', async () => {
    await getProducts({ q: '' });
    const [url] = (fetch as any).mock.calls[0];
    expect(url).not.toContain('q=');
  });

  it('includes numeric fields like priceMin/priceMax', async () => {
    await getProducts({ priceMin: 1000, priceMax: 5000 });
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('priceMin=1000');
    expect(url).toContain('priceMax=5000');
  });

  it('produces a bare path with no query string when nothing is set', async () => {
    await getProducts({});
    const [url] = (fetch as any).mock.calls[0];
    expect(url).not.toContain('?');
  });

  it('getProductBySlug requests the product by slug path', async () => {
    await getProductBySlug('gold-ring');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/products/gold-ring');
  });

  it('getProductReviews paginates with page and pageSize', async () => {
    await getProductReviews('p1', 2, 5);
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('page=2');
    expect(url).toContain('pageSize=5');
  });
});

describe('getMyReview — FEAT-PENDING-REVIEW-VISIBILITY', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests /reviews/mine with the productId and bearer token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'r1', moderationStatus: 'PENDING' }), { status: 200 }),
      ),
    );
    const review = await getMyReview('tok-1', 'p1');
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain('/reviews/mine');
    expect(url).toContain('productId=p1');
    expect(init.headers.Authorization).toBe('Bearer tok-1');
    expect(review).toMatchObject({ id: 'r1' });
  });

  it('turns a 404 into null — not-yet-reviewed is a normal state, not an error a caller should have to unwrap', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'You have not reviewed this product' }), { status: 404 }),
      ),
    );
    await expect(getMyReview('tok-1', 'p1')).resolves.toBeNull();
  });

  it('still throws on a genuine failure — a 404 is the only status this function swallows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })),
    );
    await expect(getMyReview('bad-token', 'p1')).rejects.toThrow('Unauthorized');
  });
});
