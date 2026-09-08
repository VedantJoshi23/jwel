import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  adminCreatePincodeOverride,
  adminDeletePincodeOverride,
  adminListPincodeOverrides,
  adminUpdatePincodeOverride,
  checkServiceability,
} from './shipping';

function respond(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

describe('checkServiceability', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the public serviceability endpoint with the encoded pincode', async () => {
    respond({ pincode: '400001', deliverable: true, estimatedMinDays: 4, estimatedMaxDays: 7, source: 'ESTIMATED' });
    await checkServiceability('400001');
    expect((fetch as any).mock.calls[0][0]).toContain('/shipping/serviceability?pincode=400001');
  });

  it('sends no Authorization header — this is a public endpoint', async () => {
    respond({ pincode: '400001', deliverable: true, estimatedMinDays: 4, estimatedMaxDays: 7, source: 'ESTIMATED' });
    await checkServiceability('400001');
    const [, init] = (fetch as any).mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('propagates a server error rather than swallowing it', async () => {
    respond({ message: 'boom' }, 500);
    await expect(checkServiceability('400001')).rejects.toThrow();
  });
});

describe('admin pincode overrides', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists overrides with pagination params', async () => {
    respond({ items: [], page: 1, pageSize: 50, total: 0 });
    await adminListPincodeOverrides('t1', 2, 20);
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('page=2');
    expect(url).toContain('pageSize=20');
  });

  it('creates an override with a bearer token', async () => {
    respond({ id: 'o1', pincode: '400001' });
    await adminCreatePincodeOverride('t1', { pincode: '400001' });
    const [, init] = (fetch as any).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer t1');
  });

  it('updates an override by id', async () => {
    respond({ id: 'o1' });
    await adminUpdatePincodeOverride('t1', 'o1', { note: 'x' });
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/shipping/pincode-overrides/o1');
    expect(init.method).toBe('PATCH');
  });

  it('deletes an override by id', async () => {
    respond(undefined);
    await adminDeletePincodeOverride('t1', 'o1');
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/shipping/pincode-overrides/o1');
    expect(init.method).toBe('DELETE');
  });
});
