import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus, PaymentProvider, PaymentStatus, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CouponsService } from '../coupons/coupons.service';
import { PaymentsService } from '../payments/payments.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Role } from '../../common/enums/role.enum';

// How long an unpaid checkout may hold its reserved stock. Comfortably
// longer than Razorpay's ~12-minute modal session, so a slow bank redirect
// or an app-switch to complete UPI is never cut short.
const ORDER_PAYMENT_TTL_MS = 30 * 60 * 1000;

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PLACED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly couponsService: CouponsService,
    private readonly paymentsService: PaymentsService,
    private readonly eventBus: EventBusService,
  ) {}

  // Order owns its own status transitions (Law 1) — Payments only ever
  // publishes `payment.succeeded`; this listener is what actually moves the
  // order into CONFIRMED, then republishes `order.confirmed` for
  // Notifications (see NotificationsService.onModuleInit).
  onModuleInit(): void {
    this.eventBus.on('payment.succeeded', (payload) => this.confirmPayment(payload.orderId, payload.amountMinorUnits));
  }

  private async confirmPayment(orderId: string, amountMinorUnits: number): Promise<void> {
    // A payment can legitimately succeed for an order the expiry sweep has
    // already cancelled: the shopper opened the modal, sat past the TTL, then
    // paid. Auto-confirming would be wrong — the sweep released that stock and
    // it may since have been sold, so CONFIRMED would promise goods that no
    // longer exist.
    //
    // The money did arrive, and Payments has already recorded that. What is
    // left is a human decision (refund, or re-source the item), so this fails
    // loudly rather than quietly resurrecting the order.
    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });

    if (existing?.status === OrderStatus.CANCELLED) {
      this.logger.error(
        `Payment succeeded for order ${orderId}, which was already CANCELLED (likely expired ` +
          `before payment completed). Stock was released and has NOT been re-reserved. The ` +
          `customer has been charged — this needs a manual refund or fulfilment decision.`,
      );
      return;
    }

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CONFIRMED,
        statusHistory: { create: { status: OrderStatus.CONFIRMED, note: 'Payment succeeded' } },
      },
      include: { user: { select: { email: true } } },
    });

    this.eventBus.emit('order.confirmed', {
      orderId: order.id,
      userEmail: order.user.email,
      totalMinorUnits: amountMinorUnits,
    });
  }

  /**
   * Releases stock held by checkouts that were never paid for.
   *
   * Checkout reserves inventory inside the same transaction that creates the
   * order, so a shopper cannot lose the item while the payment modal is open.
   * The cost is that an abandoned modal holds that stock — and until now
   * nothing ever released it. Four abandoned checkouts made a 5-unit item
   * unbuyable during Milestone 12's live validation; on a single-unit piece,
   * one is enough.
   *
   * Safety properties, in order of importance:
   *
   * 1. **A paid order is never cancelled.** Only orders whose Payment is still
   *    PENDING are eligible, and the transition is a conditional `updateMany`
   *    on `status: PLACED`. If a webhook confirms the order between the query
   *    and the write, the update matches zero rows and this skips it.
   * 2. **Stock is released only if that transition actually won.** Releasing
   *    first would corrupt `quantity_reserved` for an order that turned out to
   *    be confirmed — dropping a reservation the order still depends on.
   * 3. **The TTL is generous.** Razorpay's modal session is ~12 minutes; 30
   *    leaves room for a slow bank redirect or a shopper switching apps to
   *    complete a UPI payment.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStalePendingOrders(): Promise<number> {
    const cutoff = new Date(Date.now() - ORDER_PAYMENT_TTL_MS);

    const stale = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PLACED,
        createdAt: { lt: cutoff },
        // An order with no Payment row at all (initiation failed and
        // compensation already ran) is not this sweep's business.
        payment: { is: { status: PaymentStatus.PENDING } },
      },
      select: { id: true, items: { select: { variantId: true, quantity: true } } },
    });

    let expired = 0;

    for (const order of stale) {
      const { count } = await this.prisma.order.updateMany({
        where: { id: order.id, status: OrderStatus.PLACED },
        data: { status: OrderStatus.CANCELLED },
      });

      if (count === 0) {
        this.logger.log(`Order ${order.id} was confirmed while expiring; leaving it alone.`);
        continue;
      }

      await this.prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.CANCELLED,
          note: 'Payment not completed within the allowed window',
        },
      });

      for (const item of order.items) {
        await this.inventoryService.release(item.variantId, item.quantity);
      }

      expired += 1;
      this.logger.log(`Expired unpaid order ${order.id} and released its reserved stock.`);
    }

    if (expired > 0) {
      this.logger.log(`Expiry sweep cancelled ${expired} unpaid order(s).`);
    }
    return expired;
  }

  /**
   * Checkout orchestration (FR-9). Stock reservation + order/coupon-redemption
   * writes happen inside one DB transaction so a mid-flight failure can't leave
   * stock reserved without a corresponding order. Payment-intent creation is a
   * network call to an external provider and deliberately happens *after* that
   * transaction commits — holding a Postgres transaction open across an
   * external HTTP call would hold row locks for the call's full latency. If the
   * payment-intent call fails, the just-committed order/reservation is
   * compensated (released + cancelled) rather than left dangling.
   */
  async create(userId: string, dto: CreateOrderDto) {
    const variantIds = dto.items.map((item) => item.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });

    if (variants.length !== variantIds.length) {
      throw new BadRequestException('One or more items in this order no longer exist');
    }
    const unavailable = variants.find((v) => v.product.status !== ProductStatus.PUBLISHED || v.product.deletedAt);
    if (unavailable) {
      throw new BadRequestException(`${unavailable.product.name} is no longer available for purchase`);
    }

    const variantById = new Map(variants.map((v) => [v.id, v]));
    const subtotalMinorUnits = dto.items.reduce((sum, item) => {
      const variant = variantById.get(item.variantId)!;
      return sum + variant.basePriceMinorUnits * item.quantity;
    }, 0);

    let discountMinorUnits = 0;
    let couponId: string | undefined;
    if (dto.couponCode) {
      const validation = await this.couponsService.validate(dto.couponCode, subtotalMinorUnits, userId);
      discountMinorUnits = validation.discountMinorUnits;
      couponId = validation.coupon.id;
    }

    const shippingMinorUnits = 0; // free shipping, matches GLINT wireframe promo banner
    const totalMinorUnits = subtotalMinorUnits - discountMinorUnits + shippingMinorUnits;

    const order = await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await this.inventoryService.reserve(item.variantId, item.quantity, tx);
      }

      const created = await tx.order.create({
        data: {
          userId,
          status: OrderStatus.PLACED,
          subtotalMinorUnits,
          discountMinorUnits,
          shippingMinorUnits,
          totalMinorUnits,
          couponId,
          shippingAddress: dto.shippingAddress as unknown as Prisma.InputJsonValue,
          items: {
            create: dto.items.map((item) => {
              const variant = variantById.get(item.variantId)!;
              return {
                variantId: item.variantId,
                productNameSnapshot: variant.product.name,
                variantSnapshot: {
                  metal: variant.metal,
                  purity: variant.purity,
                  size: variant.size,
                } as unknown as Prisma.InputJsonValue,
                quantity: item.quantity,
                unitPriceMinorUnits: variant.basePriceMinorUnits,
              };
            }),
          },
          statusHistory: { create: { status: OrderStatus.PLACED, note: 'Order placed' } },
        },
        include: { items: true },
      });

      if (couponId) {
        await this.couponsService.redeem(couponId, created.id, userId, tx);
      }

      return created;
    });

    try {
      const { checkout } = await this.paymentsService.initiateForOrder(
        order.id,
        totalMinorUnits,
        dto.paymentProvider ?? PaymentProvider.RAZORPAY,
      );
      // `checkout` carries only client-safe values (the public key id and the
      // gateway's order id) — see CheckoutHandle in payment-provider.port.ts.
      return { orderId: order.id, totalMinorUnits, checkout };
    } catch (error) {
      this.logger.error(`Payment initiation failed for order ${order.id}, compensating`, error as Error);
      await this.compensateFailedCheckout(order.id, dto.items);
      throw error;
    }
  }

  private async compensateFailedCheckout(
    orderId: string,
    items: { variantId: string; quantity: number }[],
  ): Promise<void> {
    await Promise.all(items.map((item) => this.inventoryService.release(item.variantId, item.quantity)));
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        statusHistory: { create: { status: OrderStatus.CANCELLED, note: 'Payment initiation failed' } },
      },
    });
  }

  async findForUser(userId: string, query: PaginationQueryDto): Promise<PaginatedResult<any>> {
    const { page, pageSize } = query;
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  async findOne(orderId: string, requester: { userId: string; role: string }) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, statusHistory: { orderBy: { occurredAt: 'asc' } }, payment: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const isOwner = order.userId === requester.userId;
    const isStaff = requester.role === Role.ADMIN || requester.role === Role.STAFF;
    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You cannot view another customer’s order');
    }
    return order;
  }

  async adminFindAll(query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const { page, pageSize } = query;
    // Previously ignored its own pagination params and returned a bare
    // array with no customer info — every other admin list endpoint
    // (Users, Coupons, Reviews) returns a real paginated envelope; this
    // didn't, which the Admin Portal's Orders page (Milestone 10) surfaced
    // immediately since it has no way to show who placed an order.
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { items: true, user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.order.count(),
    ]);
    return { items, page, pageSize, total };
  }

  async adminUpdateStatus(orderId: string, nextStatus: OrderStatus, note?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot transition order from ${order.status} to ${nextStatus}`);
    }

    if (nextStatus === OrderStatus.SHIPPED) {
      for (const item of order.items) {
        await this.inventoryService.commit(item.variantId, item.quantity);
      }
    }
    if (nextStatus === OrderStatus.CANCELLED) {
      for (const item of order.items) {
        await this.inventoryService.release(item.variantId, item.quantity);
      }
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: nextStatus,
        statusHistory: { create: { status: nextStatus, note } },
      },
      include: { items: true, statusHistory: true },
    });
  }
}
