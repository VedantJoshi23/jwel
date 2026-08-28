import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateCouponDto } from './dto/create-coupon.dto';

type Client = PrismaService | Prisma.TransactionClient;

export interface CouponValidationResult {
  coupon: Coupon;
  discountMinorUnits: number;
}

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

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

  /**
   * Soft-delete — hides the coupon from `adminList` and makes `validate`
   * reject it (same check `deletedAt` already backs), while leaving
   * `CouponRedemption` history and any `Order.couponId` reference intact.
   * Always safe, regardless of redemption history (`DOM-PRICING` §8 Edge
   * Case 6). There is deliberately no "un-archive" — same as Product/Category
   * soft-delete, this is a one-way action from the admin surface today.
   */
  async adminArchive(id: string, actor: AuthenticatedUser): Promise<Coupon> {
    const coupon = await this.findOrThrow(id);
    const archived = await this.prisma.coupon.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.auditLog.record({
      actor,
      action: 'coupons.archive',
      entityType: 'Coupon',
      entityId: id,
      metadata: { code: coupon.code },
    });

    return archived;
  }

  /**
   * A real, irreversible delete — refused once the coupon has ever been
   * redeemed. `CouponRedemption` is an append-only ledger (`DOM-PRICING` §8
   * Invariant 2) and `Order.couponId` is a historical reference; destroying
   * either would violate `STD-DATABASE` r3 (history is append-only) and could
   * silently corrupt a past order's discount record. A never-redeemed coupon
   * has no such reference and can be removed outright — this is what
   * distinguishes it from `adminArchive`, not an admin preference alone.
   */
  async adminHardDelete(id: string, actor: AuthenticatedUser): Promise<void> {
    const coupon = await this.findOrThrow(id);

    const redemptionCount = await this.prisma.couponRedemption.count({ where: { couponId: id } });
    if (redemptionCount > 0) {
      throw new BadRequestException(
        `Coupon "${coupon.code}" has been redeemed ${redemptionCount} time(s) and cannot be permanently ` +
          'deleted — archive it instead to keep redemption history intact.',
      );
    }

    try {
      await this.prisma.coupon.delete({ where: { id } });
    } catch (error) {
      // Defensive backstop, not the primary check: an Order references a
      // coupon via `Order.couponId` independently of CouponRedemption, so the
      // database's own foreign key is what actually guarantees this, not the
      // count() above alone. Translated into the same named error rather than
      // a raw constraint-violation code reaching an admin.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException(
          `Coupon "${coupon.code}" is referenced by at least one order and cannot be permanently deleted — ` +
            'archive it instead.',
        );
      }
      throw error;
    }

    await this.auditLog.record({
      actor,
      action: 'coupons.hard_delete',
      entityType: 'Coupon',
      entityId: id,
      metadata: { code: coupon.code, discountType: coupon.discountType, value: coupon.value },
    });
  }

  private async findOrThrow(id: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return coupon;
  }
}
