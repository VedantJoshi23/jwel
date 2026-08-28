import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminListSettings, adminUpdateSetting } from './admin-settings';

describe('admin-settings API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adminListSettings GETs the admin settings endpoint with no caching', async () => {
    await adminListSettings('token-1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/settings');
    expect(options.cache).toBe('no-store');
  });

  it('adminUpdateSetting PATCHes the setting-specific path with the value wrapped', async () => {
    await adminUpdateSetting('token-1', 'returns.window_days', 14);
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/settings/returns.window_days');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ value: 14 });
  });

  it('adminUpdateSetting forwards a boolean value', async () => {
    await adminUpdateSetting('token-1', 'announcement.active', false);
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ value: false });
  });

  it('adminUpdateSetting forwards a string value', async () => {
    await adminUpdateSetting('token-1', 'announcement.text', 'Hello');
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ value: 'Hello' });
  });

  it('sends the bearer token', async () => {
    await adminListSettings('token-1');
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer token-1');
  });
});
