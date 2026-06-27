import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';

type Client = PrismaService | Prisma.TransactionClient;

export interface CouponValidationResult {
  coupon: Coupon;
  discountMinorUnits: number;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(
    code: string,
    subtotalMinorUnits: number,
    userId: string,
  ): Promise<CouponValidationResult> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    const now = new Date();

    if (!coupon || coupon.deletedAt || !coupon.isActive) {
      throw new NotFoundException('Coupon not found or no longer active');
    }
    if (now < coupon.validFrom || now > coupon.validTo) {
      throw new BadRequestException('This coupon is not valid at this time');
    }
    if (coupon.minOrderAmountMinorUnits && subtotalMinorUnits < coupon.minOrderAmountMinorUnits) {
      throw new BadRequestException('Order does not meet the minimum amount for this coupon');
    }

    const [globalRedemptions, userRedemptions] = await Promise.all([
      this.prisma.couponRedemption.count({ where: { couponId: coupon.id } }),
      this.prisma.couponRedemption.count({ where: { couponId: coupon.id, userId } }),
    ]);
    if (coupon.maxRedemptions && globalRedemptions >= coupon.maxRedemptions) {
      throw new BadRequestException('This coupon has reached its redemption limit');
    }
    if (userRedemptions >= coupon.maxRedemptionsPerUser) {
      throw new BadRequestException('You have already used this coupon the maximum number of times');
    }

    if (coupon.discountType === DiscountType.FIRST_ORDER) {
      const priorOrders = await this.prisma.order.count({ where: { userId } });
      if (priorOrders > 0) {
        throw new BadRequestException('This coupon is only valid on a first order');
      }
    }

    return { coupon, discountMinorUnits: this.computeDiscount(coupon, subtotalMinorUnits) };
  }

  private computeDiscount(coupon: Coupon, subtotalMinorUnits: number): number {
    switch (coupon.discountType) {
      case DiscountType.FLAT:
        return Math.min(coupon.value, subtotalMinorUnits);
      case DiscountType.PERCENTAGE:
      case DiscountType.FIRST_ORDER:
        return Math.floor((subtotalMinorUnits * coupon.value) / 100);
      default:
        return 0;
    }
  }

  // Append-only — see DATABASE.md §3 (`coupon_redemptions`). Called from within
  // the Orders module's checkout transaction, hence the injectable Client param.
  async redeem(couponId: string, orderId: string, userId: string, client: Client = this.prisma) {
    return client.couponRedemption.create({ data: { couponId, orderId, userId } });
  }

  adminList() {
    return this.prisma.coupon.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
  }

  adminCreate(dto: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        ...dto,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
      },
    });
  }

  async adminDeactivate(id: string) {
    return this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
  }
}
