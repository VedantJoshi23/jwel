import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSizes, safeGetSizes } from './sizes';
import * as client from './client';

const option = {
  scheme: 'RING_INDIA' as const,
  value: '16',
  label: '16',
  circumferenceMm: '56.3',
  diameterMm: '17.93',
  usEquivalent: '8',
  ukEquivalent: 'P½',
};

afterEach(() => vi.restoreAllMocks());

describe('getSizes', () => {
  it('requests all schemes when none is given', async () => {
    const spy = vi.spyOn(client, 'apiFetch').mockResolvedValue([option]);
    await getSizes();
    expect(spy).toHaveBeenCalledWith('/sizes', expect.objectContaining({ revalidate: 3600 }));
  });

  it('passes the scheme as a query parameter', async () => {
    const spy = vi.spyOn(client, 'apiFetch').mockResolvedValue([option]);
    await getSizes('CHAIN_LENGTH_MM');
    expect(spy).toHaveBeenCalledWith('/sizes?scheme=CHAIN_LENGTH_MM', expect.anything());
  });
});

describe('safeGetSizes', () => {
  it('returns [] without calling the API for a null scheme', async () => {
    const spy = vi.spyOn(client, 'apiFetch');
    await expect(safeGetSizes(null)).resolves.toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns [] without calling the API for 'NONE'", async () => {
    // NONE means the category explicitly has no size — asking the server for
    // its options would be a guaranteed-empty round trip.
    const spy = vi.spyOn(client, 'apiFetch');
    await expect(safeGetSizes('NONE')).resolves.toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns options for a real scheme', async () => {
    vi.spyOn(client, 'apiFetch').mockResolvedValue([option]);
    await expect(safeGetSizes('RING_INDIA')).resolves.toEqual([option]);
  });

  it('swallows an API failure so the listing still renders', async () => {
    // The size filter is an enhancement; an unreachable API must not take the
    // whole category page down with it.
    vi.spyOn(client, 'apiFetch').mockRejectedValue(new Error('unreachable'));
    await expect(safeGetSizes('RING_INDIA')).resolves.toEqual([]);
  });
});
