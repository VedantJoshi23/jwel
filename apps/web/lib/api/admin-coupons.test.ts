import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminArchiveCoupon,
  adminCreateCoupon,
  adminDeactivateCoupon,
  adminHardDeleteCoupon,
  adminListCoupons,
} from './admin-coupons';

describe('admin-coupons API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adminListCoupons GETs the admin coupons endpoint', async () => {
    await adminListCoupons('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/coupons');
  });

  it('adminCreateCoupon POSTs the input', async () => {
    const input = { code: 'X', discountType: 'PERCENTAGE' as const, value: 10, validFrom: 'a', validTo: 'b' };
    await adminCreateCoupon('token-1', input);
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(input);
  });

  it('adminDeactivateCoupon PATCHes the deactivate endpoint', async () => {
    await adminDeactivateCoupon('token-1', 'c1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/coupons/c1/deactivate');
    expect(options.method).toBe('PATCH');
  });

  it('adminArchiveCoupon PATCHes the archive endpoint', async () => {
    await adminArchiveCoupon('token-1', 'c1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/coupons/c1/archive');
    expect(options.method).toBe('PATCH');
  });

  it('adminHardDeleteCoupon DELETEs the coupon directly, with no sub-path', async () => {
    await adminHardDeleteCoupon('token-1', 'c1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/coupons/c1');
    expect(url).not.toContain('/archive');
    expect(url).not.toContain('/deactivate');
    expect(options.method).toBe('DELETE');
  });
});
