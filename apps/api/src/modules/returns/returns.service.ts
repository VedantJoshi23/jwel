import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, ReturnStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentsService } from '../payments/payments.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// `user: { select: ... }`, never `include: { user: true }` — a bare include
// pulls the full User row (passwordHash and all) straight into the API
// response. Caught during Milestone 7 validation; same bug class already
// fixed once in UsersService (BACKEND.md §3.7) and reintroduced here by a
// careless include — worth remembering this is an easy mistake to repeat.
const returnInclude = {
  orderItem: {
    include: {
      order: { include: { user: { select: { id: true, email: true } } } },
      variant: true,
    },
  },
  statusHistory: { orderBy: { occurredAt: 'asc' as const } },
};

// FR-11. Eligibility: the order must be DELIVERED (you can't return what
// hasn't arrived) and each OrderItem may have at most one ReturnRequest — the
// latter is also enforced at the DB level by the unique constraint on
// `return_requests.order_item_id` (DATABASE.md §3), this check just produces
// a clean 409 instead of a raw Prisma P2002 surfacing through the filter.
const ALLOWED_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  [ReturnStatus.REQUESTED]: [ReturnStatus.APPROVED, ReturnStatus.REJECTED],
  [ReturnStatus.APPROVED]: [ReturnStatus.REFUND_PROCESSING],
  [ReturnStatus.REJECTED]: [],
  [ReturnStatus.REFUND_PROCESSING]: [ReturnStatus.REFUNDED],
  [ReturnStatus.REFUNDED]: [],
};

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly paymentsService: PaymentsService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(userId: string, dto: CreateReturnDto) {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: { order: { include: { user: true } }, returnRequest: true },
    });
    if (!orderItem) {
      throw new NotFoundException('Order item not found');
    }
    if (orderItem.order.userId !== userId) {
      throw new ForbiddenException('You cannot request a return for another customer’s order');
    }
    if (orderItem.order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders are eligible for return');
    }
    if (orderItem.returnRequest) {
      throw new ConflictException('A return has already been requested for this item');
    }

    const returnRequest = await this.prisma.returnRequest.create({
      data: {
        orderItemId: dto.orderItemId,
        reason: dto.reason,
        notes: dto.notes,
        status: ReturnStatus.REQUESTED,
        statusHistory: { create: { status: ReturnStatus.REQUESTED } },
      },
      include: returnInclude,
    });

    this.eventBus.emit('return.requested', {
      returnId: returnRequest.id,
      userEmail: orderItem.order.user.email,
      productName: orderItem.productNameSnapshot,
    });

    return returnRequest;
  }

  async findOne(returnId: string, requester: { userId: string; role: string }) {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: returnInclude,
    });
    if (!returnRequest) {
      throw new NotFoundException('Return not found');
    }
    const isOwner = returnRequest.orderItem.order.userId === requester.userId;
    const isStaff = requester.role === Role.ADMIN || requester.role === Role.STAFF;
    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You cannot view another customer’s return');
    }
    return returnRequest;
  }

  findForUser(userId: string) {
    return this.prisma.returnRequest.findMany({
      where: { orderItem: { order: { userId } } },
      include: returnInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  adminFindAll(query: PaginationQueryDto, status?: ReturnStatus) {
    const { page, pageSize } = query;
    return this.prisma.returnRequest.findMany({
      where: status ? { status } : undefined,
      include: returnInclude,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminUpdateStatus(returnId: string, nextStatus: ReturnStatus, refundAmountMinorUnits?: number) {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: returnInclude,
    });
    if (!returnRequest) {
      throw new NotFoundException('Return not found');
    }

    const allowed = ALLOWED_TRANSITIONS[returnRequest.status];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot transition return from ${returnRequest.status} to ${nextStatus}`);
    }
    if (nextStatus === ReturnStatus.REFUNDED && refundAmountMinorUnits === undefined) {
      throw new BadRequestException('refundAmountMinorUnits is required when marking a return as refunded');
    }

    if (nextStatus === ReturnStatus.REFUNDED) {
      const { variantId, quantity } = returnRequest.orderItem;
      await this.inventoryService.restock(variantId, quantity);

      // Payments owns the `payment` table (Law 1) — Returns calls its
      // service method rather than writing that row itself. See
      // PaymentsService.markRefunded for the Stripe-refund-API caveat.
      await this.paymentsService.markRefunded(returnRequest.orderItem.orderId);
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id: returnId },
      data: {
        status: nextStatus,
        refundAmountMinorUnits,
        statusHistory: { create: { status: nextStatus } },
      },
      include: returnInclude,
    });

    if (nextStatus === ReturnStatus.REFUNDED) {
      this.eventBus.emit('return.refunded', {
        returnId: updated.id,
        userEmail: updated.orderItem.order.user.email,
        refundAmountMinorUnits: refundAmountMinorUnits!,
      });
    }

    return updated;
  }
}
