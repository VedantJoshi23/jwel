import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCoupon } from './coupons';

describe('validateCoupon', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs code and subtotal with the auth token attached', async () => {
    await validateCoupon('token-1', 'SAVE10', 100000);
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/coupons/validate');
    expect(options.headers.Authorization).toBe('Bearer token-1');
    expect(JSON.parse(options.body)).toEqual({ code: 'SAVE10', subtotalMinorUnits: 100000 });
  });
});
