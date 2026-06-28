import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

const user = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };

describe('RecommendationsController', () => {
  let service: {
    recordView: jest.Mock;
    getRecentlyViewed: jest.Mock;
    getFrequentlyBoughtTogether: jest.Mock;
    getTrending: jest.Mock;
    getPersonalized: jest.Mock;
    backfillCoOccurrence: jest.Mock;
  };
  let controller: RecommendationsController;

  beforeEach(() => {
    service = {
      recordView: jest.fn().mockResolvedValue(undefined),
      getRecentlyViewed: jest.fn().mockReturnValue('recent'),
      getFrequentlyBoughtTogether: jest.fn().mockReturnValue('fbt'),
      getTrending: jest.fn().mockReturnValue('trending'),
      getPersonalized: jest.fn().mockReturnValue('personalized'),
      backfillCoOccurrence: jest.fn().mockReturnValue('backfilled'),
    };
    controller = new RecommendationsController(service as unknown as RecommendationsService);
  });

  it('recordView passes the logged-in user id, ignoring any client-supplied anonymousId', async () => {
    await controller.recordView('p1', { anonymousId: 'anon-1' } as any, user);
    expect(service.recordView).toHaveBeenCalledWith('p1', { userId: 'u1', anonymousId: 'anon-1' });
  });

  it('recordView falls back to anonymousId when there is no logged-in user', async () => {
    await controller.recordView('p1', { anonymousId: 'anon-1' } as any, null);
    expect(service.recordView).toHaveBeenCalledWith('p1', { userId: undefined, anonymousId: 'anon-1' });
  });

  it('getRecentlyViewed builds identity from the current user or query anonymousId', () => {
    expect(controller.getRecentlyViewed({ limit: 5, anonymousId: 'anon-1' } as any, user)).toBe('recent');
    expect(service.getRecentlyViewed).toHaveBeenCalledWith({ userId: 'u1', anonymousId: 'anon-1' }, 5);
  });

  it('getFrequentlyBoughtTogether delegates with productId and limit', () => {
    expect(controller.getFrequentlyBoughtTogether('p1', { limit: 3 } as any)).toBe('fbt');
    expect(service.getFrequentlyBoughtTogether).toHaveBeenCalledWith('p1', 3);
  });

  it('getTrending delegates with limit', () => {
    expect(controller.getTrending({ limit: 10 } as any)).toBe('trending');
  });

  it('getPersonalized delegates with the current user id and limit', () => {
    expect(controller.getPersonalized(user, { limit: 5 } as any)).toBe('personalized');
    expect(service.getPersonalized).toHaveBeenCalledWith('u1', 5);
  });

  it('backfillCoOccurrence delegates with no args', () => {
    expect(controller.backfillCoOccurrence()).toBe('backfilled');
  });
});
