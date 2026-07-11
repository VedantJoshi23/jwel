import { Module } from '@nestjs/common';
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
    StripePaymentProvider,
    RazorpayPaymentProviderStub,
    MockPaymentProvider,
    {
      provide: PAYMENT_PROVIDER_STRIPE,
      useExisting: isProduction ? StripePaymentProvider : MockPaymentProvider,
    },
    {
      provide: PAYMENT_PROVIDER_RAZORPAY,
      useExisting: isProduction ? RazorpayPaymentProviderStub : MockPaymentProvider,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
