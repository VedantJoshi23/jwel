import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

const user = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };

describe('WishlistController', () => {
  let service: { getWishlist: jest.Mock; addItem: jest.Mock; removeItem: jest.Mock; getByShareToken: jest.Mock };
  let controller: WishlistController;

  beforeEach(() => {
    service = {
      getWishlist: jest.fn().mockReturnValue('wishlist'),
      addItem: jest.fn().mockReturnValue('added'),
      removeItem: jest.fn().mockReturnValue('removed'),
      getByShareToken: jest.fn().mockReturnValue('shared'),
    };
    controller = new WishlistController(service as unknown as WishlistService);
  });

  it('getWishlist delegates with the current user id', () => {
    expect(controller.getWishlist(user)).toBe('wishlist');
    expect(service.getWishlist).toHaveBeenCalledWith('u1');
  });

  it('addItem delegates with userId and variantId', () => {
    expect(controller.addItem(user, { variantId: 'v1' } as any)).toBe('added');
    expect(service.addItem).toHaveBeenCalledWith('u1', 'v1');
  });

  it('removeItem delegates with userId and variantId', () => {
    expect(controller.removeItem(user, 'v1')).toBe('removed');
    expect(service.removeItem).toHaveBeenCalledWith('u1', 'v1');
  });

  it('getShared delegates with the share token, no auth required', () => {
    expect(controller.getShared('token-123')).toBe('shared');
    expect(service.getByShareToken).toHaveBeenCalledWith('token-123');
  });
});
