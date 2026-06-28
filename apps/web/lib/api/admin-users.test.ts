import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminListUsers, adminSuspendUser } from './admin-users';

describe('admin-users API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adminListUsers paginates with defaults page=1, pageSize=20', async () => {
    await adminListUsers('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('page=1');
    expect(url).toContain('pageSize=20');
  });

  it('adminSuspendUser PATCHes the suspend endpoint for the target user', async () => {
    await adminSuspendUser('token-1', 'u2');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/users/u2/suspend');
    expect(options.method).toBe('PATCH');
  });
});
