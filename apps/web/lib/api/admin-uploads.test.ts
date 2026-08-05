import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminUploadImage } from './admin-uploads';

describe('adminUploadImage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ storageRef: 'local:banners/x.jpg', url: 'https://cdn/x.jpg' }), {
          status: 200,
        }),
      ),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function file() {
    return new File(['bytes'], 'diwali.jpg', { type: 'image/jpeg' });
  }

  it('posts to the folder-specific upload route', async () => {
    await adminUploadImage('token-1', 'banners', file());
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/uploads/banners');
    expect(options.method).toBe('POST');
  });

  it('sends the file as multipart form data under the field name "file"', async () => {
    await adminUploadImage('token-1', 'collections', file());
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get('file')).toBeInstanceOf(File);
  });

  // The browser sets Content-Type (with the multipart boundary) only when it
  // sees a FormData body with no manual header. Setting it by hand produces a
  // request the server cannot parse.
  it('does not set Content-Type itself', async () => {
    await adminUploadImage('token-1', 'banners', file());
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers?.['Content-Type']).toBeUndefined();
  });

  it('sends the bearer token', async () => {
    await adminUploadImage('token-1', 'banners', file());
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer token-1');
  });

  it('returns the ref to persist and the url to preview', async () => {
    await expect(adminUploadImage('token-1', 'banners', file())).resolves.toEqual({
      storageRef: 'local:banners/x.jpg',
      url: 'https://cdn/x.jpg',
    });
  });
});
