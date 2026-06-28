import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProducts, getProductBySlug, getProductReviews } from './products';

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
