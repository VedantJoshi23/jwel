import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

const user = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };

describe('OrdersController', () => {
  let service: { create: jest.Mock; findForUser: jest.Mock; findOne: jest.Mock; adminFindAll: jest.Mock; adminUpdateStatus: jest.Mock };
  let controller: OrdersController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockReturnValue('created'),
      findForUser: jest.fn().mockReturnValue('orders'),
      findOne: jest.fn().mockReturnValue('order'),
      adminFindAll: jest.fn().mockReturnValue('admin-list'),
      adminUpdateStatus: jest.fn().mockReturnValue('status-updated'),
    };
    controller = new OrdersController(service as unknown as OrdersService);
  });

  it('create delegates with the current user id and dto', () => {
    const dto = { items: [] };
    expect(controller.create(user, dto as any)).toBe('created');
    expect(service.create).toHaveBeenCalledWith('u1', dto);
  });

  it('findForUser delegates with the current user id and query', () => {
    const query = { page: 1, pageSize: 10 };
    expect(controller.findForUser(user, query as any)).toBe('orders');
    expect(service.findForUser).toHaveBeenCalledWith('u1', query);
  });

  it('findOne delegates with the order id and the requester', () => {
    expect(controller.findOne(user, 'o1')).toBe('order');
    expect(service.findOne).toHaveBeenCalledWith('o1', user);
  });

  it('adminFindAll delegates with the query', () => {
    const query = { page: 1, pageSize: 10 };
    expect(controller.adminFindAll(query as any)).toBe('admin-list');
    expect(service.adminFindAll).toHaveBeenCalledWith(query);
  });

  it('adminUpdateStatus delegates with id, status, and note', () => {
    expect(controller.adminUpdateStatus('o1', { status: 'CONFIRMED', note: 'ok' } as any)).toBe('status-updated');
    expect(service.adminUpdateStatus).toHaveBeenCalledWith('o1', 'CONFIRMED', 'ok');
  });
});
