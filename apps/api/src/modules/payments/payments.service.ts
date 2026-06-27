import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { OrderStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import {
  PAYMENT_PROVIDER_RAZORPAY,
  PAYMENT_PROVIDER_STRIPE,
  PaymentProviderPort,
} from './ports/payment-provider.port';
import { StripePaymentProvider } from './providers/stripe-payment.provider';

type Client = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER_STRIPE) private readonly stripeProvider: PaymentProviderPort,
    @Inject(PAYMENT_PROVIDER_RAZORPAY) private readonly razorpayProvider: PaymentProviderPort,
    private readonly stripe: StripePaymentProvider,
    private readonly eventBus: EventBusService,
  ) {}

  private resolveProvider(provider: PaymentProvider): PaymentProviderPort {
    if (provider === PaymentProvider.STRIPE) return this.stripeProvider;
    if (provider === PaymentProvider.RAZORPAY) return this.razorpayProvider;
    throw new BadRequestException(`Unsupported payment provider: ${provider}`);
  }

  async initiateForOrder(
    orderId: string,
    amountMinorUnits: number,
    provider: PaymentProvider,
    client: Client = this.prisma,
  ) {
    const adapter = this.resolveProvider(provider);
    const intent = await adapter.createPaymentIntent({
      orderId,
      amountMinorUnits,
      currency: 'INR',
    });

    const payment = await client.payment.create({
      data: {
        orderId,
        provider,
        status: PaymentStatus.PENDING,
        amountMinorUnits,
        providerRef: intent.providerRef,
      },
    });

    return { payment, clientSecret: intent.clientSecret };
  }

  // The Order-state update still happens directly here (not purely via the
  // event bus) because it's the same aggregate this service is authoritative
  // for confirming — but the *side effect* (notifying the customer) now goes
  // through EventBusService.emit('order.confirmed', ...) rather than
  // PaymentsService calling a Notification service directly. This is the
  // event-bus gap named in BACKEND.md §4, closed for this one event; Order ->
  // Inventory and Order -> Analytics from ARCHITECTURE.md §5's event catalog
  // remain direct calls for now (OrdersService already calls InventoryService
  // directly, which is the inventory-update path, not a missing wiring).
  // Idempotent on `providerRef` + current status check, so a duplicated
  // webhook delivery is safe to replay without double-emitting the event.
  async handleStripeWebhook(rawBody: Buffer, signatureHeader: string): Promise<void> {
    const event = this.stripe.constructEvent(rawBody, signatureHeader);

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as { id: string };
      await this.markSucceeded(intent.id);
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as { id: string };
      await this.markFailed(intent.id);
    } else {
      this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  private async markSucceeded(providerRef: string): Promise<void> {
    // select, not include, on `user` — see returns.service.ts's comment on the
    // same mistake; this path never reaches an HTTP response today, but
    // over-fetching passwordHash here is still the wrong default to copy.
    const payment = await this.prisma.payment.findUnique({
      where: { providerRef },
      include: { order: { include: { user: { select: { id: true, email: true } } } } },
    });
    if (!payment || payment.status === PaymentStatus.SUCCEEDED) {
      return;
    }
    await this.prisma.$transaction([
      this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCEEDED } }),
      this.prisma.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.CONFIRMED } }),
      this.prisma.orderStatusHistory.create({
        data: { orderId: payment.orderId, status: OrderStatus.CONFIRMED, note: 'Payment succeeded' },
      }),
    ]);

    this.eventBus.emit('order.confirmed', {
      orderId: payment.orderId,
      userEmail: payment.order.user.email,
      totalMinorUnits: payment.amountMinorUnits,
    });
  }

  private async markFailed(providerRef: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { providerRef } });
    if (!payment || payment.status === PaymentStatus.SUCCEEDED) {
      return;
    }
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
  }
}
