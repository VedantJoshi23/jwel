import { CartController } from './cart.controller';
import { CartService } from './cart.service';

const user = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };

describe('CartController', () => {
  let service: { getCart: jest.Mock; addItem: jest.Mock; updateItemQuantity: jest.Mock; removeItem: jest.Mock; clear: jest.Mock };
  let controller: CartController;

  beforeEach(() => {
    service = {
      getCart: jest.fn().mockReturnValue('cart'),
      addItem: jest.fn().mockReturnValue('added'),
      updateItemQuantity: jest.fn().mockReturnValue('updated'),
      removeItem: jest.fn().mockReturnValue('removed'),
      clear: jest.fn().mockReturnValue('cleared'),
    };
    controller = new CartController(service as unknown as CartService);
  });

  it('getCart delegates with the current user id', () => {
    expect(controller.getCart(user)).toBe('cart');
    expect(service.getCart).toHaveBeenCalledWith('u1');
  });

  it('addItem delegates with the current user id and dto', () => {
    const dto = { variantId: 'v1', quantity: 2 };
    expect(controller.addItem(user, dto as any)).toBe('added');
    expect(service.addItem).toHaveBeenCalledWith('u1', dto);
  });

  it('updateItem delegates with userId, variantId, and the new quantity', () => {
    expect(controller.updateItem(user, 'v1', { quantity: 5 } as any)).toBe('updated');
    expect(service.updateItemQuantity).toHaveBeenCalledWith('u1', 'v1', 5);
  });

  it('removeItem delegates with userId and variantId', () => {
    expect(controller.removeItem(user, 'v1')).toBe('removed');
    expect(service.removeItem).toHaveBeenCalledWith('u1', 'v1');
  });

  it('clear delegates with the current user id', () => {
    expect(controller.clear(user)).toBe('cleared');
    expect(service.clear).toHaveBeenCalledWith('u1');
  });
});
