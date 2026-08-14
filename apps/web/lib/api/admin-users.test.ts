import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminListUsers, adminSuspendUser, adminUnsuspendUser } from './admin-users';

describe('admin-users API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adminListUsers paginates with defaults page=1, pageSize=20, status=all', async () => {
    await adminListUsers('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('page=1');
    expect(url).toContain('pageSize=20');
    expect(url).toContain('status=all');
  });

  it('adminListUsers sends the requested status filter', async () => {
    await adminListUsers('token-1', 1, 20, 'suspended');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('status=suspended');
  });

  it('adminSuspendUser PATCHes the suspend endpoint for the target user, with a reason', async () => {
    await adminSuspendUser('token-1', 'u2', 'Fraudulent chargeback');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/users/u2/suspend');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ reason: 'Fraudulent chargeback' });
  });

  it('adminSuspendUser sends no reason field when none is given', async () => {
    await adminSuspendUser('token-1', 'u2');
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({});
  });

  it('adminUnsuspendUser PATCHes the unsuspend endpoint for the target user', async () => {
    await adminUnsuspendUser('token-1', 'u2');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/users/u2/unsuspend');
    expect(options.method).toBe('PATCH');
  });
});
