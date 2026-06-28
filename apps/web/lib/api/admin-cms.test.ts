import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminCreateBanner, adminDeleteBanner, adminListBanners, adminUpdateBanner } from './admin-cms';

describe('admin-cms API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adminListBanners GETs the admin banners endpoint', async () => {
    await adminListBanners('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/cms/banners');
  });

  it('adminCreateBanner POSTs the input', async () => {
    await adminCreateBanner('token-1', { title: 'T', imageRef: 'x.jpg' });
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ title: 'T', imageRef: 'x.jpg' });
  });

  it('adminUpdateBanner PUTs to the banner-specific path', async () => {
    await adminUpdateBanner('token-1', 'b1', { title: 'T', imageRef: 'x.jpg' });
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/cms/banners/b1');
    expect(options.method).toBe('PUT');
  });

  it('adminDeleteBanner DELETEs the banner', async () => {
    await adminDeleteBanner('token-1', 'b1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/cms/banners/b1');
    expect(options.method).toBe('DELETE');
  });
});
