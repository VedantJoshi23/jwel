import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../../prisma/prisma.service';

type MockPrisma = {
  coupon: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
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
  let service: CouponsService;

  beforeEach(() => {
    prisma = {
      coupon: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      couponRedemption: { count: jest.fn(), create: jest.fn() },
      order: { count: jest.fn() },
    };
    service = new CouponsService(prisma as unknown as PrismaService);
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
