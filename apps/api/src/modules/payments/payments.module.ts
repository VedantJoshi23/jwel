import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RazorpayPaymentProvider } from './providers/razorpay-payment.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PAYMENT_PROVIDER_RAZORPAY } from './ports/payment-provider.port';

// `MockPaymentProvider` stands in for the real gateway, but strictly outside
// production — `NODE_ENV !== 'production'` is decided once at module-init
// time from the real process environment, not a client-controllable flag,
// so a production deployment can never resolve to it.
const isProduction = process.env.NODE_ENV === 'production';

// Escape hatch for a production-shaped staging deployment that has no gateway
// credentials yet — e.g. client UAT while Razorpay onboarding is still
// pending. Checkout then completes through MockPaymentProvider and orders
// confirm with NO money moving.
//
// Deliberately opt-in and read once from the real process environment:
//   - absence means real payments, so a live shop cannot reach the mock by
//     omission, misconfiguration, or a missing env file;
//   - the literal 'simulated' is required, so a truthy-looking value like
//     PAYMENTS_MODE=live does not enable it;
//   - it is not client-controllable, same as isProduction above.
//
// The one thing this must never become is a default. See RUNBOOK §13 for the
// go-live checklist that removes it.
const isSimulatedPayments = process.env.PAYMENTS_MODE === 'simulated';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockPaymentProvider,
    // Selected through a factory, not `useExisting`, so RazorpayPaymentProvider
    // is CONSTRUCTED only when credentials exist. Listing it in `providers`
    // instead made Nest instantiate it eagerly at bootstrap regardless of
    // NODE_ENV, and its constructor calls getOrThrow('RAZORPAY_KEY_ID') —
    // so the whole app refused to boot without gateway keys, which is why
    // placeholder secrets had to be carried in .env. Mirrors the lazy
    // useFactory in storage.module.ts.
    {
      provide: PAYMENT_PROVIDER_RAZORPAY,
      inject: [ConfigService, MockPaymentProvider],
      useFactory: (config: ConfigService, mock: MockPaymentProvider) => {
        // Outside production the mock is used unconditionally. Deliberately
        // NOT keyed on whether credentials happen to be present: CI and local
        // .env carry placeholder Razorpay keys, so a credentials-based check
        // would silently route dev/e2e checkouts at the real Razorpay adapter
        // and break the demo flow.
        if (!isProduction) {
          new Logger('PaymentsModule').warn(
            'Non-production environment — using MockPaymentProvider. Payments are simulated.',
          );
          return mock;
        }

        // Logged at error level, not warn: this is a production process that
        // will confirm orders without taking money, and that fact should be
        // impossible to miss in the logs of a shop that has gone live.
        if (isSimulatedPayments) {
          new Logger('PaymentsModule').error(
            'PAYMENTS_MODE=simulated — CHECKOUT IS SIMULATED. Orders will be confirmed ' +
              'with no money moving. This must never be set on the live shop; ' +
              'remove it from .env.production before go-live (RUNBOOK §13).',
          );
          return mock;
        }

        const hasCredentials =
          !!config.get<string>('RAZORPAY_KEY_ID') &&
          !!config.get<string>('RAZORPAY_KEY_SECRET') &&
          !!config.get<string>('RAZORPAY_WEBHOOK_SECRET');
        if (!hasCredentials) {
          // Falling back to the mock here would silently mark real orders paid
          // without money moving. Refuse to start instead.
          throw new Error(
            'RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET are required ' +
              'when NODE_ENV=production. For a staging deployment with no gateway credentials ' +
              'yet, set PAYMENTS_MODE=simulated instead — never a placeholder key, which would ' +
              'boot but leave every order stuck PENDING (RUNBOOK §13).',
          );
        }

        return new RazorpayPaymentProvider(config);
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
