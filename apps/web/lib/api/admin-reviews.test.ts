import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminListPendingReviews, adminModerateReview } from './admin-reviews';

describe('admin-reviews API — FEAT-ADMIN-REVIEW-MODERATION', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adminListPendingReviews fetches the pending queue with the bearer token', async () => {
    await adminListPendingReviews('token-1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/reviews/pending');
    expect(options.headers.Authorization).toBe('Bearer token-1');
  });

  it('adminModerateReview PATCHes approval', async () => {
    await adminModerateReview('token-1', 'r1', 'APPROVED');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/reviews/r1/moderate');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ status: 'APPROVED' });
  });

  it('adminModerateReview PATCHes rejection', async () => {
    await adminModerateReview('token-1', 'r1', 'REJECTED');
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ status: 'REJECTED' });
  });
});
