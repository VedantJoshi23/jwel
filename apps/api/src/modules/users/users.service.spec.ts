import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

type MockPrisma = {
  user: { findFirst: jest.Mock; update: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  address: { findMany: jest.Mock; updateMany: jest.Mock; create: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
  $transaction: jest.Mock;
};

describe('UsersService', () => {
  let prisma: MockPrisma;
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      address: { findMany: jest.fn(), updateMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('getProfile', () => {
    it('throws NotFoundException for a nonexistent or soft-deleted user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.getProfile('u1')).rejects.toThrow(NotFoundException);
    });

    it('never selects passwordHash', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      await service.getProfile('u1');
      expect(prisma.user.findFirst.mock.calls[0][0].select).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateProfile', () => {
    it('updates and returns the safe profile fields', async () => {
      prisma.user.update.mockResolvedValue({ id: 'u1', name: 'New Name' });
      const result = await service.updateProfile('u1', { name: 'New Name' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { name: 'New Name' },
        select: expect.not.objectContaining({ passwordHash: true }),
      });
      expect(result).toEqual({ id: 'u1', name: 'New Name' });
    });
  });

  describe('listAddresses', () => {
    it('lists addresses for the user, default address first', async () => {
      prisma.address.findMany.mockResolvedValue([]);
      await service.listAddresses('u1');
      expect(prisma.address.findMany).toHaveBeenCalledWith({ where: { userId: 'u1' }, orderBy: { isDefault: 'desc' } });
    });
  });

  describe('addAddress', () => {
    it('unsets other addresses as default before creating a new default one', async () => {
      prisma.address.create.mockResolvedValue({});
      await service.addAddress('u1', { isDefault: true, line1: 'x', city: 'y', state: 'z', pincode: '1' } as any);
      expect(prisma.address.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1' }, data: { isDefault: false } });
    });

    it('does not touch other addresses when the new one is not default', async () => {
      prisma.address.create.mockResolvedValue({});
      await service.addAddress('u1', { isDefault: false, line1: 'x', city: 'y', state: 'z', pincode: '1' } as any);
      expect(prisma.address.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('removeAddress', () => {
    it('throws NotFoundException for a nonexistent address', async () => {
      prisma.address.findUnique.mockResolvedValue(null);
      await expect(service.removeAddress('u1', 'a1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the address belongs to a different user', async () => {
      prisma.address.findUnique.mockResolvedValue({ id: 'a1', userId: 'someone-else' });
      await expect(service.removeAddress('u1', 'a1')).rejects.toThrow(ForbiddenException);
      expect(prisma.address.delete).not.toHaveBeenCalled();
    });

    it('deletes the address when it belongs to the requesting user', async () => {
      prisma.address.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' });
      prisma.address.delete.mockResolvedValue({});
      await service.removeAddress('u1', 'a1');
      expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    });
  });

  describe('adminListUsers', () => {
    it('excludes soft-deleted users and returns a paginated envelope', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
      await service.adminListUsers({ page: 1, pageSize: 20 });
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
      expect(prisma.user.count.mock.calls[0][0].where).toEqual({ deletedAt: null });
    });
  });

  describe('adminSuspendUser', () => {
    it('sets deletedAt rather than hard-deleting', async () => {
      prisma.user.update.mockResolvedValue({});
      await service.adminSuspendUser('u1');
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { deletedAt: expect.any(Date) } });
    });
  });
});
