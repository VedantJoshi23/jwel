import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentProviderPort,
  WebhookOutcome,
} from '../ports/payment-provider.port';

@Injectable()
export class StripePaymentProvider implements PaymentProviderPort {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.stripe = new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-06-20',
    });
    this.webhookSecret = config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: input.amountMinorUnits,
      currency: input.currency.toLowerCase(),
      metadata: { orderId: input.orderId },
    });
    return { providerRef: intent.id, clientSecret: intent.client_secret as string };
  }

  // `constructEvent` throws on a bad/absent signature, and it is the first
  // thing that touches rawBody — so a forged event can never reach the
  // mapping below, let alone PaymentsService.
  parseWebhookEvent(rawBody: Buffer, signatureHeader: string): WebhookOutcome {
    const event = this.stripe.webhooks.constructEvent(rawBody, signatureHeader, this.webhookSecret);

    if (event.type === 'payment_intent.succeeded') {
      return { kind: 'succeeded', providerRef: (event.data.object as Stripe.PaymentIntent).id };
    }
    if (event.type === 'payment_intent.payment_failed') {
      return { kind: 'failed', providerRef: (event.data.object as Stripe.PaymentIntent).id };
    }
    return { kind: 'ignored', description: event.type };
  }
}
