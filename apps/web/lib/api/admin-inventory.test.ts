import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adjustStock, getInventory, listInventory, listLowStock } from './admin-inventory';

describe('admin-inventory API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listLowStock GETs the low-stock endpoint', async () => {
    await listLowStock('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/inventory/low-stock');
  });

  it('getInventory GETs the variant-specific endpoint', async () => {
    await getInventory('token-1', 'v1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/inventory/v1');
  });

  it('adjustStock PATCHes with the delta', async () => {
    await adjustStock('token-1', 'v1', -5);
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/inventory/v1/adjust');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ delta: -5 });
  });

  it('listInventory GETs the paginated endpoint with no query params by default', async () => {
    await listInventory('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/inventory');
    expect(url).not.toContain('/admin/inventory/');
  });

  it('listInventory carries the search, low-stock-only and pagination params', async () => {
    await listInventory('token-1', { page: 2, pageSize: 24, q: 'ring', lowStockOnly: true });
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('page=2');
    expect(url).toContain('pageSize=24');
    expect(url).toContain('q=ring');
    expect(url).toContain('lowStockOnly=true');
  });

  it('listInventory omits lowStockOnly entirely when false, rather than sending a literal "false"', async () => {
    await listInventory('token-1', { lowStockOnly: false });
    const [url] = (fetch as any).mock.calls[0];
    expect(url).not.toContain('lowStockOnly');
  });
});
