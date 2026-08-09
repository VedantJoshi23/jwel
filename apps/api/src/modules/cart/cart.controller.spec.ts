import { UnauthorizedException } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

const user = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };
const GUEST = 'guest-token-1';

describe('CartController', () => {
  let service: {
    getCart: jest.Mock;
    addItem: jest.Mock;
    updateItemQuantity: jest.Mock;
    removeItem: jest.Mock;
    clear: jest.Mock;
    claimGuestCart: jest.Mock;
  };
  let controller: CartController;

  beforeEach(() => {
    service = {
      getCart: jest.fn().mockReturnValue('cart'),
      addItem: jest.fn().mockReturnValue('added'),
      updateItemQuantity: jest.fn().mockReturnValue('updated'),
      removeItem: jest.fn().mockReturnValue('removed'),
      clear: jest.fn().mockReturnValue('cleared'),
      claimGuestCart: jest.fn().mockReturnValue('claimed'),
    };
    controller = new CartController(service as unknown as CartService);
  });

  describe('identity — DOM-SHOPPING Invariant 5', () => {
    it('uses the account for a signed-in caller', () => {
      expect(controller.getCart(user)).toBe('cart');
      expect(service.getCart).toHaveBeenCalledWith({ userId: 'u1' });
    });

    it('uses the guest token for an anonymous caller', () => {
      expect(controller.getCart(null, GUEST)).toBe('cart');
      expect(service.getCart).toHaveBeenCalledWith({ guestToken: GUEST });
    });

    it('lets the account win when a request carries both', () => {
      // A guest token is an unauthenticated bearer credential in a header.
      // Honouring it alongside a login would let anyone read or edit a guest
      // cart by presenting its token with their own account.
      controller.getCart(user, GUEST);
      expect(service.getCart).toHaveBeenCalledWith({ userId: 'u1' });
    });

    it('refuses a request with neither, rather than inventing an empty cart', () => {
      // An empty cart here would quietly discard whatever the shopper just
      // added.
      expect(() => controller.getCart(null, undefined)).toThrow(UnauthorizedException);
      expect(service.getCart).not.toHaveBeenCalled();
    });
  });

  it('addItem passes the identity and the dto', () => {
    const dto = { variantId: 'v1', quantity: 2, giftWrap: true, giftNote: 'For Diya' };
    expect(controller.addItem(user, dto as never)).toBe('added');
    expect(service.addItem).toHaveBeenCalledWith({ userId: 'u1' }, dto);
  });

  it('addresses a line by its own id, not by variant', () => {
    // A variant can appear twice — wrapped and unwrapped are two lines
    // (Invariant 1) — so a variant id stopped identifying anything.
    expect(controller.updateItem(user, 'line-1', { quantity: 5 } as never)).toBe('updated');
    expect(service.updateItemQuantity).toHaveBeenCalledWith({ userId: 'u1' }, 'line-1', 5);

    expect(controller.removeItem(null, 'line-1', GUEST)).toBe('removed');
    expect(service.removeItem).toHaveBeenCalledWith({ guestToken: GUEST }, 'line-1');
  });

  it('clear passes the identity', () => {
    expect(controller.clear(null, GUEST)).toBe('cleared');
    expect(service.clear).toHaveBeenCalledWith({ guestToken: GUEST });
  });

  it('claim passes the guest token and the chosen strategy', () => {
    expect(controller.claim(user, { guestToken: GUEST, strategy: 'merge' })).toBe('claimed');
    expect(service.claimGuestCart).toHaveBeenCalledWith('u1', GUEST, 'merge');
  });

  it('claim without a strategy leaves the decision open', () => {
    controller.claim(user, { guestToken: GUEST });
    expect(service.claimGuestCart).toHaveBeenCalledWith('u1', GUEST, undefined);
  });
});
