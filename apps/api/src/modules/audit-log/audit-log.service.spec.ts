import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const actor: AuthenticatedUser = { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };

type MockPrisma = {
  auditLog: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
};

describe('AuditLogService', () => {
  let prisma: MockPrisma;
  let service: AuditLogService;

  beforeEach(() => {
    prisma = {
      auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };
    service = new AuditLogService(prisma as unknown as PrismaService);
  });

  describe('record', () => {
    it('writes an entry with the actor id/email split from the metadata', async () => {
      prisma.auditLog.create.mockResolvedValue({});
      await service.record({
        actor,
        action: 'order.status_updated',
        entityType: 'Order',
        entityId: 'o1',
        metadata: { from: 'PLACED', to: 'CONFIRMED' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'admin-1',
          actorEmail: 'admin@example.com',
          action: 'order.status_updated',
          entityType: 'Order',
          entityId: 'o1',
          metadata: { from: 'PLACED', to: 'CONFIRMED' },
        },
      });
    });

    it('propagates a write failure rather than swallowing it', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));
      await expect(
        service.record({ actor, action: 'order.status_updated', entityType: 'Order', entityId: 'o1' }),
      ).rejects.toThrow('db down');
    });
  });

  describe('list', () => {
    it('filters by entityType/entityId/actorId when provided', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await service.list({ entityType: 'Order', entityId: 'o1', actorId: 'admin-1' }, { page: 1, pageSize: 20 });
      expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({
        entityType: 'Order',
        entityId: 'o1',
        actorId: 'admin-1',
      });
    });

    it('applies no filter when none is provided', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await service.list({}, { page: 1, pageSize: 20 });
      expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('orders by createdAt descending and paginates', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await service.list({}, { page: 2, pageSize: 10 });
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' }, skip: 10, take: 10 }),
      );
    });

    it('returns the paginated envelope', async () => {
      const items = [{ id: 'a1' }];
      prisma.auditLog.findMany.mockResolvedValue(items);
      prisma.auditLog.count.mockResolvedValue(1);
      const result = await service.list({}, { page: 1, pageSize: 20 });
      expect(result).toEqual({ items, page: 1, pageSize: 20, total: 1 });
    });
  });
});
