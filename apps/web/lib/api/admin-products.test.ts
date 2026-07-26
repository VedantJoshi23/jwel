import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminCreateProduct,
  adminGetProduct,
  adminListCategories,
  adminListProducts,
  adminRemoveProductMedia,
  adminReorderProductMedia,
  adminUpdateProduct,
  adminUpdateProductStatus,
  adminUploadProductMedia,
  bulkImportProducts,
} from './admin-products';

describe('admin-products API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adminListCategories GETs the admin categories endpoint', async () => {
    await adminListCategories('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/categories');
  });

  it('adminListCategories opts out of caching so a new category shows immediately', async () => {
    await adminListCategories('token-1');
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.cache).toBe('no-store');
  });

  it('adminCreateProduct POSTs the product with its variants', async () => {
    const input = {
      name: 'Halo Ring',
      slug: 'halo-ring',
      categoryId: 'c1',
      description: 'A halo of pavé diamonds.',
      variants: [
        {
          sku: 'HR-18K-6',
          metal: 'GOLD' as const,
          weightGrams: 4.2,
          basePriceMinorUnits: 8500000,
        },
      ],
    };
    await adminCreateProduct('token-1', input);
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/products');
    expect(options.method).toBe('POST');
    // Round-tripped whole rather than field-by-field: a variant silently
    // dropped in serialisation creates a product nobody can buy.
    expect(JSON.parse(options.body)).toEqual(input);
  });

  it('adminUpdateProduct PATCHes the product-specific path', async () => {
    await adminUpdateProduct('token-1', 'p1', { name: 'Renamed' });
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/products/p1');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ name: 'Renamed' });
  });

  it('adminUpdateProduct forwards variant price updates', async () => {
    await adminUpdateProduct('token-1', 'p1', {
      variantPriceUpdates: [{ variantId: 'v1', basePriceMinorUnits: 9000000 }],
    });
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      variantPriceUpdates: [{ variantId: 'v1', basePriceMinorUnits: 9000000 }],
    });
  });

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

  it('adminUploadProductMedia POSTs the photo as multipart form data to the product’s media endpoint', async () => {
    const file = new File(['bytes'], 'photo.png', { type: 'image/png' });
    await adminUploadProductMedia('token-1', 'p1', file);
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/products/p1/media');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('file')).toBe(file);
  });

  it('adminRemoveProductMedia DELETEs the specific media item', async () => {
    await adminRemoveProductMedia('token-1', 'p1', 'm1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/products/p1/media/m1');
    expect(options.method).toBe('DELETE');
  });

  it('adminReorderProductMedia PUTs the new mediaIds order', async () => {
    await adminReorderProductMedia('token-1', 'p1', ['m2', 'm1']);
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/products/p1/media/reorder');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ mediaIds: ['m2', 'm1'] });
  });
});
