import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import {
  CheckoutResult,
  PAYMENT_PROVIDER_RAZORPAY,
  PaymentProviderPort,
} from './ports/payment-provider.port';
import { MockPaymentProvider } from './providers/mock-payment.provider';

type Client = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER_RAZORPAY) private readonly provider: PaymentProviderPort,
    private readonly eventBus: EventBusService,
  ) {}

  async initiateForOrder(
    orderId: string,
    amountMinorUnits: number,
    provider: PaymentProvider,
    client: Client = this.prisma,
  ) {
    // RAZORPAY is the only provider with an adapter (ADR-0005). `STRIPE`
    // survives in the Prisma enum because dropping an enum value costs a
    // migration for no benefit, so a caller can still name it — and gets a
    // clear rejection rather than being silently routed at Razorpay.
    if (provider !== PaymentProvider.RAZORPAY) {
      throw new BadRequestException(
        `Unsupported payment provider: ${provider}. Razorpay is the only configured provider.`,
      );
    }

    const intent = await this.provider.createPaymentIntent({
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
    // handleWebhook below). The mock provider has no webhook to wait
    // for, so it confirms itself immediately — this is the only path that
    // ever calls markSucceeded outside a real signed callback, and
    // it's unreachable in production (see payments.module.ts).
    if (this.provider instanceof MockPaymentProvider) {
      await this.markSucceeded(intent.providerRef);
    }

    return { payment, checkout: intent.checkout };
  }

  // Payments only ever writes its own `payment` row here (Law 1 — no
  // cross-module table writes, see M2 Constitution). The Order-state
  // transition into CONFIRMED, and the resulting `order.confirmed`
  // notification, are owned entirely by OrdersService, which listens for
  // `payment.succeeded` (see OrdersService.onModuleInit). Idempotent on
  // `providerRef` + current status check, so a duplicated webhook delivery
  // is safe to replay without double-emitting the event.
  async handleWebhook(rawBody: Buffer, signatureHeader: string): Promise<void> {
    // Goes through the port, not the concrete adapter. Signature
    // verification happens inside parseWebhookEvent and throws before any
    // payload is trusted.
    const outcome = this.provider.parseWebhookEvent(rawBody, signatureHeader);

    if (outcome.kind === 'succeeded') {
      await this.markSucceeded(outcome.providerRef);
    } else if (outcome.kind === 'failed') {
      await this.markFailed(outcome.providerRef);
    } else {
      this.logger.log(`Unhandled Razorpay event type: ${outcome.description}`);
    }
  }

  /**
   * Called by the browser immediately after the Checkout modal succeeds, so
   * the shopper sees a confirmed order without waiting on webhook delivery.
   *
   * This is a convenience path, not the authority. Everything it can do, the
   * webhook also does — and the webhook is what runs if the browser closes,
   * loses connectivity, or never calls this at all. It shares markSucceeded's
   * idempotency, so the two racing is a no-op rather than a double-confirm.
   */
  async confirmFromCheckout(result: CheckoutResult): Promise<void> {
    // Throws on a bad signature before anything is trusted — the payload
    // arrived from a browser and is attacker-controllable (SECURITY.md §4).
    const outcome = this.provider.verifyCheckoutResult(result);

    if (outcome.kind === 'succeeded') {
      await this.markSucceeded(outcome.providerRef);
    } else if (outcome.kind === 'failed') {
      await this.markFailed(outcome.providerRef);
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

  /**
   * Owned by Payments (Law 1) — Returns calls this rather than writing
   * `payment` rows itself.
   *
   * Money moves first, bookkeeping second, and that order is deliberate: if
   * the gateway call throws, this throws too and the row keeps its previous
   * status. The alternative ordering can mark a Payment REFUNDED while the
   * customer never receives the money, which is strictly worse than a return
   * that visibly failed and can be retried.
   *
   * Only SUCCEEDED payments are refundable — refunding a PENDING or FAILED
   * row would ask the gateway to return money it never captured.
   */
  async refundForOrder(orderId: string, amountMinorUnits?: number): Promise<void> {
    // `Payment.orderId` is @unique, so an order has at most one payment —
    // no loop, and no ambiguity about which one a partial amount applies to.
    const payment = await this.prisma.payment.findUnique({ where: { orderId } });

    if (!payment || payment.status !== PaymentStatus.SUCCEEDED) {
      this.logger.warn(
        `Refund requested for order ${orderId} but it has no succeeded payment ` +
          `(status: ${payment?.status ?? 'none'}); nothing to refund.`,
      );
      return;
    }

    if (!payment.providerRef) {
      // Unreachable by construction — initiateForOrder always writes one, and
      // a payment cannot reach SUCCEEDED without a callback that matched on
      // it. Refusing beats a non-null assertion: money is involved, and the
      // alternative is asking the gateway to refund `undefined`.
      throw new BadRequestException(
        `Payment ${payment.id} for order ${orderId} has no provider reference; cannot refund.`,
      );
    }

    const refund = await this.provider.refund({
      providerRef: payment.providerRef,
      amountMinorUnits,
    });
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REFUNDED },
    });
    this.logger.log(
      `Refunded payment ${payment.id} for order ${orderId} (gateway ref ${refund.refundRef})`,
    );
  }
}
