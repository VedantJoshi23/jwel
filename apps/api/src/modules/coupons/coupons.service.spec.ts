import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const actor: AuthenticatedUser = { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };

type MockPrisma = {
  coupon: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  couponRedemption: { count: jest.Mock; create: jest.Mock };
  order: { count: jest.Mock };
};

function buildCoupon(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date();
  return {
    id: 'coupon-1',
    code: 'SAVE10',
    discountType: DiscountType.PERCENTAGE,
    value: 10,
    minOrderAmountMinorUnits: null,
    maxRedemptions: null,
    maxRedemptionsPerUser: 1,
    validFrom: new Date(now.getTime() - 86400000),
    validTo: new Date(now.getTime() + 86400000),
    isActive: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('CouponsService', () => {
  let prisma: MockPrisma;
  let auditLog: { record: jest.Mock };
  let service: CouponsService;

  beforeEach(() => {
    prisma = {
      coupon: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      couponRedemption: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      order: { count: jest.fn() },
    };
    auditLog = { record: jest.fn() };
    service = new CouponsService(prisma as unknown as PrismaService, auditLog as unknown as AuditLogService);
  });

  describe('validate', () => {
    it('throws NotFoundException when the coupon code does not exist', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);
      await expect(service.validate('NOPE', 1000, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the coupon is soft-deleted', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon({ deletedAt: new Date() }));
      await expect(service.validate('SAVE10', 1000, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the coupon is inactive', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon({ isActive: false }));
      await expect(service.validate('SAVE10', 1000, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when used before its valid window', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        buildCoupon({ validFrom: new Date(Date.now() + 86400000), validTo: new Date(Date.now() + 172800000) }),
      );
      await expect(service.validate('SAVE10', 1000, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when used after its valid window', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        buildCoupon({ validFrom: new Date(Date.now() - 172800000), validTo: new Date(Date.now() - 86400000) }),
      );
      await expect(service.validate('SAVE10', 1000, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when subtotal is below the minimum order amount', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon({ minOrderAmountMinorUnits: 5000 }));
      await expect(service.validate('SAVE10', 1000, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the global redemption cap is reached', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon({ maxRedemptions: 5 }));
      prisma.couponRedemption.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
      await expect(service.validate('SAVE10', 1000, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when this user has already used their per-user allowance', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon({ maxRedemptionsPerUser: 1 }));
      prisma.couponRedemption.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      await expect(service.validate('SAVE10', 1000, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for a FIRST_ORDER coupon when the user has prior orders', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon({ discountType: DiscountType.FIRST_ORDER, value: 15 }));
      prisma.couponRedemption.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.order.count.mockResolvedValue(2);
      await expect(service.validate('SAVE10', 1000, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('computes a PERCENTAGE discount correctly, rounding down', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon({ discountType: DiscountType.PERCENTAGE, value: 10 }));
      prisma.couponRedemption.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      const result = await service.validate('SAVE10', 99999, 'user-1');
      expect(result.discountMinorUnits).toBe(9999); // floor(99999 * 10 / 100) = 9999.9 -> 9999
    });

    it('computes a FLAT discount, capped at the subtotal (never a negative total)', async () => {
      prisma.coupon.findUnique.mockResolvedValue(
        buildCoupon({ discountType: DiscountType.FLAT, value: 50000 }),
      );
      prisma.couponRedemption.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      const result = await service.validate('SAVE10', 30000, 'user-1');
      expect(result.discountMinorUnits).toBe(30000); // capped at subtotal, not 50000
    });

    it('computes a FIRST_ORDER discount as a percentage when the user has no prior orders', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon({ discountType: DiscountType.FIRST_ORDER, value: 20 }));
      prisma.couponRedemption.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.order.count.mockResolvedValue(0);
      const result = await service.validate('SAVE10', 100000, 'user-1');
      expect(result.discountMinorUnits).toBe(20000);
    });
  });

  describe('adminCreate', () => {
    it('converts validFrom/validTo strings to Date objects before persisting', async () => {
      prisma.coupon.create.mockResolvedValue(buildCoupon());
      await service.adminCreate({
        code: 'NEW10',
        discountType: DiscountType.PERCENTAGE,
        value: 10,
        validFrom: '2026-01-01T00:00:00.000Z',
        validTo: '2026-12-31T00:00:00.000Z',
      });
      const callArg = prisma.coupon.create.mock.calls[0][0];
      expect(callArg.data.validFrom).toBeInstanceOf(Date);
      expect(callArg.data.validTo).toBeInstanceOf(Date);
    });
  });

  describe('adminDeactivate', () => {
    it('sets isActive to false', async () => {
      prisma.coupon.update.mockResolvedValue(buildCoupon({ isActive: false }));
      await service.adminDeactivate('coupon-1');
      expect(prisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { isActive: false },
      });
    });
  });

  describe('adminArchive', () => {
    it('throws NotFoundException for an unknown id', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);
      await expect(service.adminArchive('missing', actor)).rejects.toThrow(NotFoundException);
    });

    it('sets deletedAt regardless of redemption history — always safe (DOM-PRICING §8 Edge Case 6)', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon());
      prisma.coupon.update.mockResolvedValue(buildCoupon({ deletedAt: new Date() }));
      await service.adminArchive('coupon-1', actor);
      expect(prisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { deletedAt: expect.any(Date) },
      });
      // No redemption check at all — archiving never needs one.
      expect(prisma.couponRedemption.count).not.toHaveBeenCalled();
    });

    it('records an audit entry', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon());
      prisma.coupon.update.mockResolvedValue(buildCoupon({ deletedAt: new Date() }));
      await service.adminArchive('coupon-1', actor);
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ actor, action: 'coupons.archive', entityId: 'coupon-1' }),
      );
    });
  });

  describe('adminHardDelete', () => {
    it('throws NotFoundException for an unknown id', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);
      await expect(service.adminHardDelete('missing', actor)).rejects.toThrow(NotFoundException);
    });

    it('deletes a never-redeemed coupon outright', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon());
      prisma.couponRedemption.count.mockResolvedValue(0);
      await service.adminHardDelete('coupon-1', actor);
      expect(prisma.coupon.delete).toHaveBeenCalledWith({ where: { id: 'coupon-1' } });
    });

    it('refuses to delete a coupon that has been redeemed, naming the count', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon());
      prisma.couponRedemption.count.mockResolvedValue(3);
      await expect(service.adminHardDelete('coupon-1', actor)).rejects.toThrow(/redeemed 3 time\(s\)/);
      expect(prisma.coupon.delete).not.toHaveBeenCalled();
    });

    it('translates a foreign-key violation from the database into the same named error (defensive backstop)', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon());
      prisma.couponRedemption.count.mockResolvedValue(0);
      prisma.coupon.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('FK violation', {
          code: 'P2003',
          clientVersion: '5.0.0',
        }),
      );
      await expect(service.adminHardDelete('coupon-1', actor)).rejects.toThrow(BadRequestException);
    });

    it('propagates an unrelated database error rather than mislabeling it', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon());
      prisma.couponRedemption.count.mockResolvedValue(0);
      prisma.coupon.delete.mockRejectedValue(new Error('connection reset'));
      await expect(service.adminHardDelete('coupon-1', actor)).rejects.toThrow('connection reset');
    });

    it('records an audit entry only after the delete succeeds', async () => {
      prisma.coupon.findUnique.mockResolvedValue(buildCoupon());
      prisma.couponRedemption.count.mockResolvedValue(0);
      await service.adminHardDelete('coupon-1', actor);
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ actor, action: 'coupons.hard_delete', entityId: 'coupon-1' }),
      );
    });
  });

  describe('redeem', () => {
    it('creates an append-only redemption record on the default client', async () => {
      prisma.couponRedemption.create.mockResolvedValue({});
      await service.redeem('coupon-1', 'order-1', 'user-1');
      expect(prisma.couponRedemption.create).toHaveBeenCalledWith({
        data: { couponId: 'coupon-1', orderId: 'order-1', userId: 'user-1' },
      });
    });

    it('uses the supplied transaction client when one is passed in', async () => {
      const tx = { couponRedemption: { create: jest.fn().mockResolvedValue({}) } };
      await service.redeem('coupon-1', 'order-1', 'user-1', tx as any);
      expect(tx.couponRedemption.create).toHaveBeenCalled();
      expect(prisma.couponRedemption.create).not.toHaveBeenCalled();
    });
  });

  describe('adminList', () => {
    it('excludes soft-deleted coupons, newest first', async () => {
      prisma.coupon.findMany.mockResolvedValue([]);
      await service.adminList();
      expect(prisma.coupon.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
