import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StripePaymentProvider } from './providers/stripe-payment.provider';
import { RazorpayPaymentProviderStub } from './providers/razorpay-payment.provider.stub';
import { PAYMENT_PROVIDER_RAZORPAY, PAYMENT_PROVIDER_STRIPE } from './ports/payment-provider.port';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    StripePaymentProvider,
    RazorpayPaymentProviderStub,
    { provide: PAYMENT_PROVIDER_STRIPE, useExisting: StripePaymentProvider },
    { provide: PAYMENT_PROVIDER_RAZORPAY, useExisting: RazorpayPaymentProviderStub },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
