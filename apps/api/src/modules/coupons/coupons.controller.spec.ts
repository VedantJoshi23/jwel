import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

const user = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };

describe('CouponsController', () => {
  let service: { validate: jest.Mock; adminList: jest.Mock; adminCreate: jest.Mock; adminDeactivate: jest.Mock };
  let controller: CouponsController;

  beforeEach(() => {
    service = {
      validate: jest.fn().mockReturnValue('validated'),
      adminList: jest.fn().mockReturnValue('list'),
      adminCreate: jest.fn().mockReturnValue('created'),
      adminDeactivate: jest.fn().mockReturnValue('deactivated'),
    };
    controller = new CouponsController(service as unknown as CouponsService);
  });

  it('validate delegates with code, subtotal, and the current user id', () => {
    expect(controller.validate(user, { code: 'SAVE10', subtotalMinorUnits: 1000 } as any)).toBe('validated');
    expect(service.validate).toHaveBeenCalledWith('SAVE10', 1000, 'u1');
  });

  it('adminList delegates with no args', () => {
    expect(controller.adminList()).toBe('list');
  });

  it('adminCreate delegates with the dto', () => {
    const dto = { code: 'X' };
    expect(controller.adminCreate(dto as any)).toBe('created');
    expect(service.adminCreate).toHaveBeenCalledWith(dto);
  });

  it('adminDeactivate delegates with the coupon id', () => {
    expect(controller.adminDeactivate('c1')).toBe('deactivated');
    expect(service.adminDeactivate).toHaveBeenCalledWith('c1');
  });
});
