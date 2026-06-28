import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const user = { userId: 'u1', email: 'a@b.com', role: 'CUSTOMER' };

describe('UsersController', () => {
  let service: {
    getProfile: jest.Mock;
    updateProfile: jest.Mock;
    listAddresses: jest.Mock;
    addAddress: jest.Mock;
    removeAddress: jest.Mock;
    adminListUsers: jest.Mock;
    adminSuspendUser: jest.Mock;
  };
  let controller: UsersController;

  beforeEach(() => {
    service = {
      getProfile: jest.fn().mockReturnValue('profile'),
      updateProfile: jest.fn().mockReturnValue('updated'),
      listAddresses: jest.fn().mockReturnValue('addresses'),
      addAddress: jest.fn().mockReturnValue('added'),
      removeAddress: jest.fn().mockReturnValue(undefined),
      adminListUsers: jest.fn().mockReturnValue('users'),
      adminSuspendUser: jest.fn().mockReturnValue(undefined),
    };
    controller = new UsersController(service as unknown as UsersService);
  });

  it('getProfile delegates with the current user id', () => {
    expect(controller.getProfile(user)).toBe('profile');
    expect(service.getProfile).toHaveBeenCalledWith('u1');
  });

  it('updateProfile delegates with userId and dto', () => {
    const dto = { name: 'New Name' };
    expect(controller.updateProfile(user, dto as any)).toBe('updated');
    expect(service.updateProfile).toHaveBeenCalledWith('u1', dto);
  });

  it('listAddresses delegates with the current user id', () => {
    expect(controller.listAddresses(user)).toBe('addresses');
  });

  it('addAddress delegates with userId and dto', () => {
    const dto = { line1: 'x', city: 'y', state: 'z', pincode: '1' };
    expect(controller.addAddress(user, dto as any)).toBe('added');
    expect(service.addAddress).toHaveBeenCalledWith('u1', dto);
  });

  it('removeAddress delegates with userId and addressId', () => {
    controller.removeAddress(user, 'a1');
    expect(service.removeAddress).toHaveBeenCalledWith('u1', 'a1');
  });

  it('adminListUsers delegates with the query', () => {
    const query = { page: 1, pageSize: 20 };
    expect(controller.adminListUsers(query as any)).toBe('users');
  });

  it('adminSuspendUser delegates with the target userId', () => {
    controller.adminSuspendUser('u2');
    expect(service.adminSuspendUser).toHaveBeenCalledWith('u2');
  });
});
