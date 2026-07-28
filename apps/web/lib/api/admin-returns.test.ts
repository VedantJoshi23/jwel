import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminListReturns, adminUpdateReturnStatus } from './admin-returns';

describe('admin-returns API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adminListReturns fetches with no query string when status is omitted', async () => {
    await adminListReturns('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/returns');
    expect(url).not.toContain('status=');
  });

  it('adminListReturns filters by status when given', async () => {
    await adminListReturns('token-1', 'REQUESTED');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/returns?status=REQUESTED');
  });

  it('adminUpdateReturnStatus PATCHes status and refund amount', async () => {
    await adminUpdateReturnStatus('token-1', 'r1', 'REFUNDED', 250000);
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/returns/r1/status');
    expect(JSON.parse(options.body)).toEqual({ status: 'REFUNDED', refundAmountMinorUnits: 250000 });
  });

  it('adminUpdateReturnStatus omits refundAmountMinorUnits when transitioning without one', async () => {
    await adminUpdateReturnStatus('token-1', 'r1', 'APPROVED');
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ status: 'APPROVED', refundAmountMinorUnits: undefined });
  });
});
