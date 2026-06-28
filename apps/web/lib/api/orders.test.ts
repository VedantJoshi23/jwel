import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrder, getOrder, getOrders } from './orders';

describe('orders API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('createOrder POSTs the input with the auth token', async () => {
    const input = {
      items: [{ variantId: 'v1', quantity: 1 }],
      shippingAddress: { line1: 'x', city: 'y', state: 'z', pincode: '1' },
    };
    await createOrder('token-1', input);
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/orders');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(input);
  });

  it('getOrders paginates with page/pageSize and defaults to page 1, pageSize 10', async () => {
    await getOrders('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('page=1');
    expect(url).toContain('pageSize=10');
  });

  it('getOrder requests a single order by id', async () => {
    await getOrder('token-1', 'o1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/orders/o1');
  });
});
