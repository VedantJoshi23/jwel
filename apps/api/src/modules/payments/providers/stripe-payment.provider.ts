import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentProviderPort,
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

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): boolean {
    try {
      this.stripe.webhooks.constructEvent(rawBody, signatureHeader, this.webhookSecret);
      return true;
    } catch {
      return false;
    }
  }

  constructEvent(rawBody: Buffer, signatureHeader: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signatureHeader, this.webhookSecret);
  }
}
