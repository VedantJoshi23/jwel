import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserStatusFilter } from './dto/list-users.dto';

type MockPrisma = {
  user: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  address: { findMany: jest.Mock; updateMany: jest.Mock; create: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
  $transaction: jest.Mock;
};

const actor: AuthenticatedUser = { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };

describe('UsersService', () => {
  let prisma: MockPrisma;
  let auditLog: { record: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      address: { findMany: jest.fn(), updateMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    auditLog = { record: jest.fn() };
    service = new UsersService(prisma as unknown as PrismaService, auditLog as unknown as AuditLogService);
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
    it('defaults to showing every user, active and suspended — the actual bug this fixes', async () => {
      // Previously the where clause was hardcoded to `{ deletedAt: null }`
      // with no way to override it, so a suspended user vanished from this
      // list the moment they were suspended — with no filter, no search, no
      // path back to finding them again to unsuspend.
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
      await service.adminListUsers({ page: 1, pageSize: 20 });
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({});
      expect(prisma.user.count.mock.calls[0][0].where).toEqual({});
    });

    it('status=active filters to non-suspended users only', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
      await service.adminListUsers({ page: 1, pageSize: 20, status: UserStatusFilter.ACTIVE });
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
    });

    it('status=suspended filters to suspended users only', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
      await service.adminListUsers({ page: 1, pageSize: 20, status: UserStatusFilter.SUSPENDED });
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ deletedAt: { not: null } });
    });

    it('selects deletedAt and suspensionReason so the admin UI can render status', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
      await service.adminListUsers({ page: 1, pageSize: 20 });
      expect(prisma.user.findMany.mock.calls[0][0].select).toMatchObject({
        deletedAt: true,
        suspensionReason: true,
      });
    });
  });

  describe('adminSuspendUser', () => {
    it('sets deletedAt rather than hard-deleting, with no reason when none is given', async () => {
      prisma.user.update.mockResolvedValue({});
      await service.adminSuspendUser('u1', actor);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { deletedAt: expect.any(Date), suspensionReason: null },
      });
    });

    it('stores the admin-supplied reason', async () => {
      prisma.user.update.mockResolvedValue({});
      await service.adminSuspendUser('u1', actor, 'Fraudulent chargeback');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { deletedAt: expect.any(Date), suspensionReason: 'Fraudulent chargeback' },
      });
    });

    it('records an audit log entry carrying the reason', async () => {
      prisma.user.update.mockResolvedValue({});
      await service.adminSuspendUser('u1', actor, 'Fraudulent chargeback');
      expect(auditLog.record).toHaveBeenCalledWith({
        actor,
        action: 'user.suspended',
        entityType: 'User',
        entityId: 'u1',
        metadata: { reason: 'Fraudulent chargeback' },
      });
    });

    it('records an audit log entry with no metadata when no reason is given', async () => {
      prisma.user.update.mockResolvedValue({});
      await service.adminSuspendUser('u1', actor);
      expect(auditLog.record).toHaveBeenCalledWith({
        actor,
        action: 'user.suspended',
        entityType: 'User',
        entityId: 'u1',
        metadata: undefined,
      });
    });
  });

  describe('adminUnsuspendUser', () => {
    it('clears deletedAt and the reason for a suspended user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', deletedAt: new Date() });
      prisma.user.update.mockResolvedValue({});
      await service.adminUnsuspendUser('u1', actor);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { deletedAt: null, suspensionReason: null },
      });
    });

    it('records an audit log entry for the unsuspension', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', deletedAt: new Date() });
      prisma.user.update.mockResolvedValue({});
      await service.adminUnsuspendUser('u1', actor);
      expect(auditLog.record).toHaveBeenCalledWith({
        actor,
        action: 'user.unsuspended',
        entityType: 'User',
        entityId: 'u1',
      });
    });

    it('throws NotFoundException for a nonexistent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.adminUnsuspendUser('missing', actor)).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the user is not currently suspended', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', deletedAt: null });
      await expect(service.adminUnsuspendUser('u1', actor)).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
