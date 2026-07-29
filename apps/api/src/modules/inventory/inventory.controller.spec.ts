import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const actor: AuthenticatedUser = { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };

describe('InventoryController', () => {
  let service: { listLowStock: jest.Mock; getByVariant: jest.Mock; adminAdjust: jest.Mock };
  let controller: InventoryController;

  beforeEach(() => {
    service = {
      listLowStock: jest.fn().mockReturnValue('low-stock'),
      getByVariant: jest.fn().mockReturnValue('item'),
      adminAdjust: jest.fn().mockReturnValue('adjusted'),
    };
    controller = new InventoryController(service as unknown as InventoryService);
  });

  it('listLowStock delegates with no args', () => {
    expect(controller.listLowStock()).toBe('low-stock');
  });

  it('getByVariant delegates with the variant id', () => {
    expect(controller.getByVariant('v1')).toBe('item');
    expect(service.getByVariant).toHaveBeenCalledWith('v1');
  });

  it('adjust delegates with the variant id and delta', () => {
    expect(controller.adjust(actor, 'v1', { delta: -5 } as any)).toBe('adjusted');
    expect(service.adminAdjust).toHaveBeenCalledWith('v1', -5, actor);
  });
});
