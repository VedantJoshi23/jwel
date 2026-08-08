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
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MetricsService } from '../metrics/metrics.service';
import { alertOperator } from '../../common/observability/alert';
import { deriveRefundState } from './refund-state';

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
    private readonly auditLogService: AuditLogService,
    private readonly metrics: MetricsService,
  ) {}

  // Order owns its own status transitions (Law 1) — Payments only ever
  // publishes `payment.succeeded`; this listener is what actually moves the
  // order into CONFIRMED, then republishes `order.confirmed` for
  // Notifications (see NotificationsService.onModuleInit).
  onModuleInit(): void {
    this.eventBus.on('payment.succeeded', (payload) => this.confirmPayment(payload.orderId, payload.amountMinorUnits));
  }

  private async confirmPayment(orderId: string, amountMinorUnits: number): Promise<void> {
    await this.confirmPlacedOrder(orderId, amountMinorUnits, 'Payment succeeded');
  }

  /**
   * Moves one order `PLACED → CONFIRMED`, idempotently.
   *
   * Shared by the `payment.succeeded` listener and the reconciliation sweep,
   * which is what makes DOM-ORDERING invariant 12 safe: the sweep re-derives
   * the reaction from durable state, so it will regularly run against orders
   * the listener already handled.
   *
   * Idempotency is a **conditional `updateMany` on `status: PLACED`**, not a
   * read-then-write. Two callers can reach here for the same order at once —
   * the browser callback, the webhook and the sweep are three independent
   * triggers — and only one may win. The loser matches zero rows and returns
   * false, so the customer gets one confirmation email rather than three.
   *
   * @returns whether this call performed the transition.
   */
  private async confirmPlacedOrder(
    orderId: string,
    amountMinorUnits: number,
    note: string,
  ): Promise<boolean> {
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
      alertOperator(
        this.logger,
        `Payment succeeded for order ${orderId}, which was already CANCELLED (likely expired ` +
          `before payment completed). Stock was released and has NOT been re-reserved. The ` +
          `customer has been charged — this needs a manual refund or fulfilment decision.`,
        { orderId, reason: 'paid-after-cancellation' },
      );
      return false;
    }

    const { count } = await this.prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PLACED },
      data: { status: OrderStatus.CONFIRMED },
    });

    if (count === 0) {
      // Already confirmed by whichever trigger got here first. Nothing to do,
      // and nothing to announce — the email went out on that path.
      return false;
    }

    await this.prisma.orderStatusHistory.create({
      data: { orderId, status: OrderStatus.CONFIRMED, note },
    });

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { user: { select: { email: true } } },
    });

    this.eventBus.emit('order.confirmed', {
      orderId: order.id,
      userEmail: order.user.email,
      totalMinorUnits: amountMinorUnits,
    });

    return true;
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
      this.metrics.orderReconciliationTotal.inc({ outcome: 'expired' });
      this.logger.log(`Expired unpaid order ${order.id} and released its reserved stock.`);
    }

    if (expired > 0) {
      // Logged, deliberately not alerted. An abandoned checkout is ordinary
      // customer behaviour, not a defect — paging someone for it would train
      // them to ignore the channel that the confirmation sweep below needs
      // them to read. Watch the rate on `order_reconciliation_total{expired}`
      // instead.
      this.logger.log(`Expiry sweep cancelled ${expired} unpaid order(s).`);
    }
    return expired;
  }

  /**
   * Confirms orders that were **paid but never confirmed** — `DOM-ORDERING`
   * invariant 12, the other half of the reconciliation sweep.
   *
   * An order reaches `CONFIRMED` by *reacting* to `payment.succeeded`. The bus
   * is in-process and at-most-once (`ARCH-001` §3.1), so that reaction is the
   * fragile link in the system's central chain: a process restart between the
   * payment write and the emit, a handler that threw, or a bug that skipped
   * confirmation all leave an order sitting at `PLACED` with the customer's
   * money taken.
   *
   * The money itself is never at risk — the `Payment` row is committed and the
   * gateway holds its own record. Only the reaction was lossy, so re-deriving
   * it from durable state is sufficient. That is `ADR-0010`'s preferred
   * mitigation, and it recovers from failures a durable bus would not.
   *
   * **Every order this finds is a bug that already charged a customer**, so
   * unlike the expiry sweep this alerts rather than logs. A sweep that
   * silently fixes things conceals the bug that made fixing necessary.
   *
   * No age cutoff. The window in invariant 11 exists to avoid cancelling a
   * checkout still in progress; there is no equivalent risk in confirming an
   * order whose payment has already succeeded, and waiting would only delay
   * the customer's confirmation email.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async confirmPaidPlacedOrders(): Promise<number> {
    const unconfirmed = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PLACED,
        payment: { is: { status: PaymentStatus.SUCCEEDED } },
      },
      select: { id: true, payment: { select: { amountMinorUnits: true } } },
    });

    let confirmed = 0;

    for (const order of unconfirmed) {
      // Re-uses the same idempotent transition the listener does, so an order
      // confirmed between the query and this call is a no-op rather than a
      // second confirmation email.
      const didConfirm = await this.confirmPlacedOrder(
        order.id,
        order.payment?.amountMinorUnits ?? 0,
        'Confirmed by reconciliation sweep — payment had succeeded',
      );

      if (didConfirm) {
        confirmed += 1;
        this.metrics.orderReconciliationTotal.inc({ outcome: 'confirmed' });
      }
    }

    if (confirmed > 0) {
      alertOperator(
        this.logger,
        `Reconciliation sweep confirmed ${confirmed} paid order(s) that were left at PLACED. ` +
          `Each one means the reaction to payment.succeeded was lost — the customer was charged ` +
          `and, until now, had an unconfirmed order. Investigate why the event did not land.`,
        { reason: 'paid-but-unconfirmed', count: String(confirmed) },
      );
    }

    return confirmed;
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
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          // `returnRequest` rides along so the partial-return flag can be
          // derived per row (DOM-RETURNS invariant 9). It is a 1:1 on
          // `order_items`, so this is not an N+1.
          items: { include: { returnRequest: { select: { status: true } } } },
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.order.count(),
    ]);

    // Invariant 9: an order reading DELIVERED while carrying refunded items is
    // indistinguishable from one that was never returned, and an admin should
    // not have to open it to find out. Derived per read rather than stored —
    // the returns table already knows (STD-DATABASE r9).
    const items = orders.map((order) => ({
      ...order,
      partiallyReturned: deriveRefundState(
        order.items.map((item) => ({ returnStatus: item.returnRequest?.status ?? null })),
      ).partiallyReturned,
    }));

    return { items, page, pageSize, total };
  }

  async adminUpdateStatus(orderId: string, nextStatus: OrderStatus, actor: AuthenticatedUser, note?: string) {
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

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: nextStatus,
        statusHistory: { create: { status: nextStatus, note } },
      },
      include: { items: true, statusHistory: true },
    });

    await this.auditLogService.record({
      actor,
      action: 'order.status_updated',
      entityType: 'Order',
      entityId: orderId,
      metadata: { from: order.status, to: nextStatus, note },
    });

    return updated;
  }

  // ────────────────────────────────────────────────────────────────────────
  // REFUND STATE — DOM-RETURNS invariants 8 and 9
  //
  // `OrderStatus.REFUNDED` was unreachable: no transition led to it (KC-178),
  // so an order whose every item came back still read DELIVERED forever.
  // Ordering owns order status (Law 5), so Returns commands this rather than
  // writing the row itself.
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Re-derives whether an order is fully refunded and transitions it if so.
   *
   * **Derived, never asserted.** Invariant 8 makes `REFUNDED` a *consequence*
   * of every item having a refunded return, which is why this reads the
   * returns rather than taking a status argument, and why `DELIVERED →
   * REFUNDED` is deliberately absent from `ALLOWED_TRANSITIONS`: an admin must
   * not be able to declare an order refunded that is not. This method is the
   * only path to that status.
   *
   * Idempotent by conditional update, like every other transition here — a
   * second call after the order is already `REFUNDED` matches nothing.
   *
   * @param actor the admin whose refund decision triggered this. A human did
   *   cause it, and the audit trail should say who rather than "system".
   * @returns whether this call performed the transition.
   */
  async refreshRefundState(orderId: string, actor: AuthenticatedUser): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        items: { select: { returnRequest: { select: { status: true } } } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const { fullyRefunded } = deriveRefundState(
      order.items.map((item) => ({ returnStatus: item.returnRequest?.status ?? null })),
    );

    if (!fullyRefunded) {
      // Partially refunded orders stay DELIVERED by design. The distinction is
      // carried in the admin presentation layer (invariant 9) rather than by a
      // PARTIALLY_REFUNDED enum value, which would ripple through the state
      // machine, the web type union and every status filter to express
      // something the returns already imply.
      return false;
    }

    const { count } = await this.prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.DELIVERED },
      data: { status: OrderStatus.REFUNDED },
    });

    if (count === 0) {
      return false;
    }

    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: OrderStatus.REFUNDED,
        note: 'Every item on this order has been refunded',
      },
    });

    await this.auditLogService.record({
      actor,
      action: 'order.status_updated',
      entityType: 'Order',
      entityId: orderId,
      metadata: { from: OrderStatus.DELIVERED, to: OrderStatus.REFUNDED, derived: true },
    });

    return true;
  }
}
