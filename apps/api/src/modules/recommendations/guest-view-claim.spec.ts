import { RecommendationsService } from './recommendations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageProviderPort } from '../storage/ports/storage-provider.port';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { SettingsService } from '../settings/settings.service';

/**
 * `DOM-RECOMMENDATION` Invariant 9 — a guest's view history transfers to the
 * account on registration, so first-session personalisation survives sign-up.
 *
 * §8.6 bounds it: *"across sessions it does not — an `anonymousId` from a
 * different browser or a much earlier visit is not claimable, since there is
 * no basis to believe it is the same person."*
 */
describe('RecommendationsService — claiming guest views', () => {
  let prisma: any;
  let service: RecommendationsService;

  beforeEach(() => {
    prisma = { productView: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) } };
    const storage = { resolveUrl: (ref: string) => `https://cdn.test/${ref}` };
    service = new RecommendationsService(
      prisma as unknown as PrismaService,
      { on: jest.fn(), emit: jest.fn() } as unknown as EventBusService,
      { get: jest.fn() } as unknown as SettingsService,
      storage as unknown as StorageProviderPort,
    );
  });

  it('claims the views made under that anonymous id', async () => {
    expect(await service.claimGuestViews('u1', 'anon-1')).toBe(3);

    expect(prisma.productView.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ anonymousId: 'anon-1' }),
      }),
    );
  });

  it('clears the anonymous id in the same write — Invariant 2 is an XOR', async () => {
    // A row carrying both would satisfy neither branch of it.
    await service.claimGuestViews('u1', 'anon-1');

    expect(prisma.productView.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: 'u1', anonymousId: null } }),
    );
  });

  it('bounds the claim in time, so a much earlier visit is not claimable (§8.6)', async () => {
    const before = Date.now();
    await service.claimGuestViews('u1', 'anon-1');

    const { viewedAt } = prisma.productView.updateMany.mock.calls[0][0].where;
    const cutoff = viewedAt.gte as Date;

    // A day back, give or take the moment the call was made.
    const windowMs = before - cutoff.getTime();
    expect(windowMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(windowMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
  });

  it('does not claim views belonging to a different anonymous id', async () => {
    await service.claimGuestViews('u1', 'anon-1');
    const { where } = prisma.productView.updateMany.mock.calls[0][0];
    expect(where.anonymousId).toBe('anon-1');
    // No OR, no `in` — exactly one id, so a claim cannot widen by accident.
    expect(Object.keys(where).sort()).toEqual(['anonymousId', 'viewedAt']);
  });

  it('reports zero when there was nothing to claim', async () => {
    prisma.productView.updateMany.mockResolvedValue({ count: 0 });
    expect(await service.claimGuestViews('u1', 'never-browsed')).toBe(0);
  });
});
