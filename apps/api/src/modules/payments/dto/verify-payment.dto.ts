import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * The three fields Razorpay Standard Checkout hands to its success handler in
 * the browser. Named after the wire format the modal produces so the mapping
 * from client to server is obvious at both ends.
 *
 * Every value here is attacker-controllable — it arrives on a client request.
 * `razorpaySignature` is what makes the other two trustworthy, and it is
 * verified server-side before any of this is acted on.
 */
export class VerifyPaymentDto {
  @ApiProperty({ example: 'order_Nq1x2y3z4a5b6c' })
  @IsString()
  razorpayOrderId: string;

  @ApiProperty({ example: 'pay_Nq1x2y3z4a5b6c' })
  @IsString()
  razorpayPaymentId: string;

  @ApiProperty({ description: 'HMAC-SHA256 of "<order_id>|<payment_id>" using the key secret' })
  @IsString()
  razorpaySignature: string;
}
