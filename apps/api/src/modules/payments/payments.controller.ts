import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { Public } from '../../common/decorators/public.decorator';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@ApiTags('payments')
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post('webhook/razorpay')
  @HttpCode(200)
  @ApiExcludeEndpoint() // signed server-to-server callback, not part of the public API surface
  async razorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    if (!signature || !req.rawBody) {
      throw new BadRequestException('Missing Razorpay signature or raw body');
    }
    await this.paymentsService.handleWebhook(req.rawBody, signature);
    return { received: true };
  }

  /**
   * Called by the browser right after the Checkout modal succeeds, so the
   * shopper is not left staring at a spinner until the webhook lands.
   *
   * `@Public()` because the signature *is* the authentication: the payload is
   * HMAC-signed with the key secret, which only Razorpay and this server know.
   * Requiring a JWT as well would add nothing — an attacker holding a valid
   * token still cannot forge the signature, while a shopper whose token
   * expired mid-checkout would be blocked from confirming a real payment.
   */
  @Public()
  @Post('verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirm a Razorpay Checkout result relayed by the browser',
    description:
      'Convenience path only. The signed webhook remains the authority and confirms the same ' +
      'payment if this is never called; both are idempotent, so the two racing is a no-op.',
  })
  async verifyPayment(@Body() dto: VerifyPaymentDto) {
    await this.paymentsService.confirmFromCheckout({
      providerRef: dto.razorpayOrderId,
      paymentId: dto.razorpayPaymentId,
      signature: dto.razorpaySignature,
    });
    return { verified: true };
  }
}
