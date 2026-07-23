import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StripePaymentProvider } from './providers/stripe-payment.provider';
import { RazorpayPaymentProviderStub } from './providers/razorpay-payment.provider.stub';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PAYMENT_PROVIDER_RAZORPAY, PAYMENT_PROVIDER_STRIPE } from './ports/payment-provider.port';

// Neither real gateway has live credentials yet (SECURITY.md), so every
// checkout would otherwise fail before an order/payment row is even created.
// `MockPaymentProvider` stands in for BOTH providers, but strictly outside
// production — `NODE_ENV !== 'production'` is decided once at module-init
// time from the real process environment, not a client-controllable flag,
// so a production deployment can never resolve to it.
const isProduction = process.env.NODE_ENV === 'production';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    RazorpayPaymentProviderStub,
    MockPaymentProvider,
    // Selected through a factory, not `useExisting`, so StripePaymentProvider
    // is CONSTRUCTED only when credentials exist. Listing it in `providers`
    // instead made Nest instantiate it eagerly at bootstrap regardless of
    // NODE_ENV, and its constructor calls getOrThrow('STRIPE_SECRET_KEY') —
    // so the whole app refused to boot without Stripe keys, which is why
    // placeholder secrets had to be carried in .env. Mirrors the lazy
    // useFactory in storage.module.ts.
    {
      provide: PAYMENT_PROVIDER_STRIPE,
      inject: [ConfigService, MockPaymentProvider],
      useFactory: (config: ConfigService, mock: MockPaymentProvider) => {
        // Outside production the mock is used unconditionally — the same
        // guarantee the previous `useExisting: isProduction ? … : Mock` gave.
        // Deliberately NOT keyed on whether credentials happen to be present:
        // CI and local .env carry placeholder Stripe keys, so a
        // credentials-based check would silently route dev/e2e checkouts at
        // the real Stripe adapter and break the demo flow.
        if (!isProduction) {
          new Logger('PaymentsModule').warn(
            'Non-production environment — using MockPaymentProvider. Payments are simulated.',
          );
          return mock;
        }

        const hasCredentials =
          !!config.get<string>('STRIPE_SECRET_KEY') && !!config.get<string>('STRIPE_WEBHOOK_SECRET');
        if (!hasCredentials) {
          // Falling back to the mock here would silently mark real orders paid
          // without money moving. Refuse to start instead.
          throw new Error(
            'STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required when NODE_ENV=production.',
          );
        }

        return new StripePaymentProvider(config);
      },
    },
    {
      provide: PAYMENT_PROVIDER_RAZORPAY,
      useExisting: isProduction ? RazorpayPaymentProviderStub : MockPaymentProvider,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
