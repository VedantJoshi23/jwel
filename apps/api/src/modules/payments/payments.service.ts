import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import {
  PAYMENT_PROVIDER_RAZORPAY,
  PAYMENT_PROVIDER_STRIPE,
  PaymentProviderPort,
} from './ports/payment-provider.port';
import { MockPaymentProvider } from './providers/mock-payment.provider';

type Client = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER_STRIPE) private readonly stripeProvider: PaymentProviderPort,
    @Inject(PAYMENT_PROVIDER_RAZORPAY) private readonly razorpayProvider: PaymentProviderPort,
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

    // Real providers confirm asynchronously via webhook (see
    // handleStripeWebhook below). The mock provider has no webhook to wait
    // for, so it confirms itself immediately — this is the only path that
    // ever calls markSucceeded outside a real signed webhook callback, and
    // it's unreachable in production (see payments.module.ts).
    if (adapter instanceof MockPaymentProvider) {
      await this.markSucceeded(intent.providerRef);
    }

    return { payment, clientSecret: intent.clientSecret };
  }

  // Payments only ever writes its own `payment` row here (Law 1 — no
  // cross-module table writes, see M2 Constitution). The Order-state
  // transition into CONFIRMED, and the resulting `order.confirmed`
  // notification, are owned entirely by OrdersService, which listens for
  // `payment.succeeded` (see OrdersService.onModuleInit). Idempotent on
  // `providerRef` + current status check, so a duplicated webhook delivery
  // is safe to replay without double-emitting the event.
  async handleStripeWebhook(rawBody: Buffer, signatureHeader: string): Promise<void> {
    // Goes through the port, not the concrete Stripe adapter. Signature
    // verification happens inside parseWebhookEvent and throws before any
    // payload is trusted.
    const outcome = this.stripeProvider.parseWebhookEvent(rawBody, signatureHeader);

    if (outcome.kind === 'succeeded') {
      await this.markSucceeded(outcome.providerRef);
    } else if (outcome.kind === 'failed') {
      await this.markFailed(outcome.providerRef);
    } else {
      this.logger.log(`Unhandled Stripe event type: ${outcome.description}`);
    }
  }

  private async markSucceeded(providerRef: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { providerRef } });
    if (!payment || payment.status === PaymentStatus.SUCCEEDED) {
      return;
    }
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCEEDED } });

    this.eventBus.emit('payment.succeeded', {
      orderId: payment.orderId,
      amountMinorUnits: payment.amountMinorUnits,
    });
  }

  private async markFailed(providerRef: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { providerRef } });
    if (!payment || payment.status === PaymentStatus.SUCCEEDED) {
      return;
    }
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
  }

  // Owned by Payments (Law 1) — Returns calls this rather than writing
  // `payment` rows itself. Bookkeeping only: this marks the Payment row
  // REFUNDED, it does not call Stripe's refund API — PaymentProviderPort has
  // no `refund` method yet, same known gap ReturnsService documented before
  // this method existed. A real refund must still be issued through the
  // Stripe dashboard/API directly until that port is extended.
  async markRefunded(orderId: string): Promise<void> {
    await this.prisma.payment.updateMany({
      where: { orderId },
      data: { status: PaymentStatus.REFUNDED },
    });
  }
}
