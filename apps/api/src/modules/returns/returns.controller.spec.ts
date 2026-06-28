import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

const user = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };

describe('ReturnsController', () => {
  let service: { create: jest.Mock; findForUser: jest.Mock; findOne: jest.Mock; adminFindAll: jest.Mock; adminUpdateStatus: jest.Mock };
  let controller: ReturnsController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockReturnValue('created'),
      findForUser: jest.fn().mockReturnValue('returns'),
      findOne: jest.fn().mockReturnValue('return'),
      adminFindAll: jest.fn().mockReturnValue('admin-list'),
      adminUpdateStatus: jest.fn().mockReturnValue('updated'),
    };
    controller = new ReturnsController(service as unknown as ReturnsService);
  });

  it('create delegates with the current user id and dto', () => {
    const dto = { orderItemId: 'oi1', reason: 'wrong size' };
    expect(controller.create(user, dto as any)).toBe('created');
    expect(service.create).toHaveBeenCalledWith('u1', dto);
  });

  it('findForUser delegates with the current user id', () => {
    expect(controller.findForUser(user)).toBe('returns');
    expect(service.findForUser).toHaveBeenCalledWith('u1');
  });

  it('findOne delegates with the return id and requester', () => {
    expect(controller.findOne(user, 'r1')).toBe('return');
    expect(service.findOne).toHaveBeenCalledWith('r1', user);
  });

  it('adminFindAll delegates with query and optional status filter', () => {
    const query = { page: 1, pageSize: 10 };
    expect(controller.adminFindAll(query as any, 'APPROVED' as any)).toBe('admin-list');
    expect(service.adminFindAll).toHaveBeenCalledWith(query, 'APPROVED');
  });

  it('adminUpdateStatus delegates with id, status, and refund amount', () => {
    expect(controller.adminUpdateStatus('r1', { status: 'REFUNDED', refundAmountMinorUnits: 5000 } as any)).toBe(
      'updated',
    );
    expect(service.adminUpdateStatus).toHaveBeenCalledWith('r1', 'REFUNDED', 5000);
  });
});
