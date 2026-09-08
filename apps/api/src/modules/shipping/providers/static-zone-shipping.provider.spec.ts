import { StaticZoneShippingProvider } from './static-zone-shipping.provider';
import { PrismaService } from '../../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';

/**
 * FEAT-DELIVERY-ESTIMATE §7 — every branch of the override-vs-default
 * fallback has its own test, per STD-TESTING.
 */
describe('StaticZoneShippingProvider', () => {
  let prisma: { pincodeServiceabilityOverride: { findUnique: jest.Mock } };
  let settings: { get: jest.Mock };
  let provider: StaticZoneShippingProvider;

  beforeEach(() => {
    prisma = { pincodeServiceabilityOverride: { findUnique: jest.fn().mockResolvedValue(null) } };
    settings = { get: jest.fn().mockImplementation((key: string) => {
      if (key === 'shipping.default_min_days') return Promise.resolve(4);
      if (key === 'shipping.default_max_days') return Promise.resolve(7);
      throw new Error(`unexpected setting read: ${key}`);
    }) };
    provider = new StaticZoneShippingProvider(
      prisma as unknown as PrismaService,
      settings as unknown as SettingsService,
    );
  });

  it('falls back to the site-wide default window when no override exists — the common case (Edge Case 1)', async () => {
    const result = await provider.checkServiceability('400001');
    expect(result).toEqual({
      pincode: '400001',
      deliverable: true,
      estimatedMinDays: 4,
      estimatedMaxDays: 7,
      source: 'ESTIMATED',
    });
  });

  it('returns deliverable: false with no window for an explicitly excluded pincode (Edge Case 2)', async () => {
    prisma.pincodeServiceabilityOverride.findUnique.mockResolvedValue({
      pincode: '855107',
      deliverable: false,
      estimatedMinDays: null,
      estimatedMaxDays: null,
    });

    const result = await provider.checkServiceability('855107');
    expect(result).toEqual({
      pincode: '855107',
      deliverable: false,
      estimatedMinDays: null,
      estimatedMaxDays: null,
      source: 'ESTIMATED',
    });
    // The default-window settings must not even be consulted for an
    // explicitly excluded pincode.
    expect(settings.get).not.toHaveBeenCalled();
  });

  it("uses the override's own window, not the site-wide default, when one is set (Edge Case 3)", async () => {
    prisma.pincodeServiceabilityOverride.findUnique.mockResolvedValue({
      pincode: '110001',
      deliverable: true,
      estimatedMinDays: 1,
      estimatedMaxDays: 2,
    });

    const result = await provider.checkServiceability('110001');
    expect(result.estimatedMinDays).toBe(1);
    expect(result.estimatedMaxDays).toBe(2);
    expect(settings.get).not.toHaveBeenCalled();
  });

  it('always reports the estimated source — never claims a carrier-verified result', async () => {
    const result = await provider.checkServiceability('400001');
    expect(result.source).toBe('ESTIMATED');
  });
});
