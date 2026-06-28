import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adjustStock, getInventory, listLowStock } from './admin-inventory';

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
});
