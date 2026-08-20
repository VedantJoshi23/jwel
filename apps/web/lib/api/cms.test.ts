import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getActiveBanners, getAnnouncement, safeGetActiveBanners, safeGetAnnouncement } from './cms';

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

describe('getAnnouncement', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the public announcement endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null', { status: 200 })));
    await getAnnouncement();
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/cms/announcement');
  });
});

describe('safeGetAnnouncement', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the announcement on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'SALE LIVE' }), { status: 200 })),
    );
    await expect(safeGetAnnouncement()).resolves.toEqual({ text: 'SALE LIVE' });
  });

  it('returns null when the strip is turned off', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null', { status: 200 })));
    await expect(safeGetAnnouncement()).resolves.toBeNull();
  });

  // Same discipline as safeGetActiveBanners — chrome shown on every page must
  // not take the whole page down when the API is unreachable.
  it('degrades to null when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(safeGetAnnouncement()).resolves.toBeNull();
  });
});
