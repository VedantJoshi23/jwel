import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminGetProduct, adminListProducts, adminUpdateProductStatus, bulkImportProducts } from './admin-products';

describe('admin-products API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adminListProducts builds a query string from provided fields only', async () => {
    await adminListProducts('token-1', { pageSize: 50 });
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/products?pageSize=50');
  });

  it('adminListProducts omits the query string entirely when no fields are set', async () => {
    await adminListProducts('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/products');
    expect(url.includes('?')).toBe(false);
  });

  it('adminGetProduct GETs the product by id', async () => {
    await adminGetProduct('token-1', 'p1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/products/p1');
  });

  it('adminUpdateProductStatus PATCHes the new status', async () => {
    await adminUpdateProductStatus('token-1', 'p1', 'PUBLISHED');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/products/p1');
    expect(JSON.parse(options.body)).toEqual({ status: 'PUBLISHED' });
  });

  it('bulkImportProducts uploads the file as multipart form data', async () => {
    const file = new File(['csv,data'], 'products.csv', { type: 'text/csv' });
    await bulkImportProducts('token-1', file);
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/products/bulk-import');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('file')).toBe(file);
  });
});
