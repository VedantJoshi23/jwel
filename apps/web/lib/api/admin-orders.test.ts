import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminListOrders, adminUpdateOrderStatus } from './admin-orders';

describe('admin-orders API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adminListOrders paginates with defaults page=1, pageSize=20', async () => {
    await adminListOrders('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('page=1');
    expect(url).toContain('pageSize=20');
  });

  it('adminUpdateOrderStatus PATCHes status and note', async () => {
    await adminUpdateOrderStatus('token-1', 'o1', 'CONFIRMED', 'manual override');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/orders/o1/status');
    expect(JSON.parse(options.body)).toEqual({ status: 'CONFIRMED', note: 'manual override' });
  });
});
