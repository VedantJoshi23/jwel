import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getActiveBanners, safeGetActiveBanners } from './cms';

describe('getActiveBanners', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('calls the public banner feed', async () => {
    await getActiveBanners();
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/cms/banners');
  });

  it('sends no Authorization header — the feed is public', async () => {
    await getActiveBanners();
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers?.Authorization).toBeUndefined();
  });
});

describe('safeGetActiveBanners', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the banners on success', async () => {
    const banners = [{ id: 'b1', title: 'Diwali' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(banners), { status: 200 })));
    await expect(safeGetActiveBanners()).resolves.toEqual(banners);
  });

  // The homepage must render with its hero, categories and product sections
  // even when the API is down — banners are the least important thing on it.
  it('degrades to an empty list when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(safeGetActiveBanners()).resolves.toEqual([]);
  });

  it('degrades to an empty list on a 5xx rather than throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'boom' }), { status: 500 })),
    );
    await expect(safeGetActiveBanners()).resolves.toEqual([]);
  });
});
