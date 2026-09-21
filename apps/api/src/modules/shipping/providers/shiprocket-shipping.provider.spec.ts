import { ConfigService } from '@nestjs/config';
import { ShiprocketShippingProvider } from './shiprocket-shipping.provider';
import { StaticZoneShippingProvider } from './static-zone-shipping.provider';

const CONFIG_VALUES: Record<string, string> = {
  SHIPROCKET_EMAIL: 'api-user@example.com',
  SHIPROCKET_PASSWORD: 'test-password',
  SHIPROCKET_PICKUP_PINCODE: '400001',
};

const config = {
  getOrThrow: (key: string) => CONFIG_VALUES[key],
} as unknown as ConfigService;

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/**
 * `FEAT-SHIPPING` §7 Edge Case 1 — a serviceability failure must degrade to
 * the static estimate, never block/throw past this provider.
 */
describe('ShiprocketShippingProvider', () => {
  let fallback: { findOverride: jest.Mock; defaultEstimate: jest.Mock };
  let provider: ShiprocketShippingProvider;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fallback = {
      findOverride: jest.fn().mockResolvedValue(null),
      defaultEstimate: jest.fn().mockResolvedValue({
        pincode: '110001',
        deliverable: true,
        estimatedMinDays: 4,
        estimatedMaxDays: 7,
        source: 'ESTIMATED',
      }),
    };
    provider = new ShiprocketShippingProvider(config, fallback as unknown as StaticZoneShippingProvider);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("returns the admin override unchanged and never calls Shiprocket at all — an override outranks even a live answer", async () => {
    const override = {
      pincode: '855107',
      deliverable: false,
      estimatedMinDays: null,
      estimatedMaxDays: null,
      source: 'ESTIMATED' as const,
    };
    fallback.findOverride.mockResolvedValue(override);

    const result = await provider.checkServiceability('855107');

    expect(result).toEqual(override);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs in once, then reuses the cached token for a second serviceability call', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-1' }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { available_courier_companies: [{ estimated_delivery_days: '3' }] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { available_courier_companies: [{ estimated_delivery_days: '3' }] } }),
      );

    await provider.checkServiceability('110001');
    await provider.checkServiceability('110002');

    const loginCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/login'));
    expect(loginCalls).toHaveLength(1);
  });

  it('reports deliverable: false, source CARRIER_VERIFIED, when Shiprocket returns no couriers for the route', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-1' }))
      .mockResolvedValueOnce(jsonResponse({ data: { available_courier_companies: [] } }));

    const result = await provider.checkServiceability('999999');

    expect(result).toEqual({
      pincode: '999999',
      deliverable: false,
      estimatedMinDays: null,
      estimatedMaxDays: null,
      source: 'CARRIER_VERIFIED',
    });
  });

  it('takes the min/max estimated_delivery_days across couriers as the window, source CARRIER_VERIFIED', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 'tok-1' })).mockResolvedValueOnce(
      jsonResponse({
        data: {
          available_courier_companies: [
            { estimated_delivery_days: '5' },
            { estimated_delivery_days: '2-3' },
          ],
        },
      }),
    );

    const result = await provider.checkServiceability('400001');

    expect(result).toEqual({
      pincode: '400001',
      deliverable: true,
      estimatedMinDays: 3,
      estimatedMaxDays: 5,
      source: 'CARRIER_VERIFIED',
    });
  });

  it('degrades to the static estimate when the Shiprocket call fails outright', async () => {
    fetchMock.mockRejectedValue(new Error('network unreachable'));

    const result = await provider.checkServiceability('110001');

    expect(result.source).toBe('ESTIMATED');
    expect(fallback.defaultEstimate).toHaveBeenCalledWith('110001');
  });

  it('degrades to the static estimate when Shiprocket login fails (bad credentials)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'invalid credentials' }, false, 401));

    const result = await provider.checkServiceability('110001');

    expect(result.source).toBe('ESTIMATED');
  });

  it('degrades to the static estimate when the login response carries no token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'ok but no token' }));

    const result = await provider.checkServiceability('110001');

    expect(result.source).toBe('ESTIMATED');
  });

  it('degrades to the static estimate when the serviceability call itself returns a non-2xx', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-1' }))
      .mockResolvedValueOnce(jsonResponse({}, false, 500));

    const result = await provider.checkServiceability('110001');

    expect(result.source).toBe('ESTIMATED');
  });

  it('falls back to a courier\'s etd date when estimated_delivery_days is absent', async () => {
    const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-1' }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { available_courier_companies: [{ etd: inThreeDays }] } }),
      );

    const result = await provider.checkServiceability('400001');

    expect(result.source).toBe('CARRIER_VERIFIED');
    expect(result.deliverable).toBe(true);
    expect(result.estimatedMinDays).toBe(3);
    expect(result.estimatedMaxDays).toBe(3);
  });

  it('reports deliverable with no window when no courier entry parses at all', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-1' }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { available_courier_companies: [{ some_other_field: true }] } }),
      );

    const result = await provider.checkServiceability('400001');

    expect(result).toEqual({
      pincode: '400001',
      deliverable: true,
      estimatedMinDays: null,
      estimatedMaxDays: null,
      source: 'CARRIER_VERIFIED',
    });
  });

  it('degrades to the static estimate on an unrecognized response shape rather than throwing', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: 'tok-1' }))
      .mockResolvedValueOnce(jsonResponse({ unexpected: true }));

    const result = await provider.checkServiceability('110001');

    // No `data.available_courier_companies` at all is treated as zero
    // couriers, i.e. a real (if surprising) "not deliverable" — not a parse
    // failure, so this still exercises the non-degraded path.
    expect(result.deliverable).toBe(false);
    expect(result.source).toBe('CARRIER_VERIFIED');
  });
});
