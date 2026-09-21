import { Body, Controller, Headers, HttpCode, Logger, Post, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ShipmentTrackingService } from './shipment-tracking.service';
import { parseShiprocketWebhook } from './providers/shiprocket-webhook';

/**
 * Shiprocket tracking webhook (ADR-0029).
 *
 * The path avoids "shiprocket"/"sr"/"kr", which Shiprocket refuses to
 * register. It must be registered on the API origin
 * (`api.elysianjewellers.com`) — the storefront apex does not proxy `/api`
 * in production.
 */
@ApiTags('shipping')
@Controller('api/v1/shipping/webhooks')
export class ShippingWebhookController {
  private readonly logger = new Logger(ShippingWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly tracking: ShipmentTrackingService,
  ) {}

  /**
   * `@Public()` because the token is the authentication — the same reasoning
   * as the Razorpay webhook, except Shiprocket sends a fixed shared token in
   * `x-api-key` rather than signing the body (ADR-0029 decision 3).
   *
   * Every authenticated delivery gets a 200, including an unknown AWB or a
   * payload that cannot be parsed: Shiprocket's "Test Webhook" will not save
   * without a 2xx, and redelivering a payload does not make it parse. What a
   * dropped update was meant to say, reconciliation recovers.
   */
  @Public()
  @Post('carrier')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async carrier(
    @Headers('x-api-key') apiKey: string | undefined,
    @Body() body: unknown,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.assertToken(apiKey);

    const update = parseShiprocketWebhook(body, req.rawBody);
    if (!update) {
      this.logger.warn('Carrier webhook payload had no usable AWB, status or timestamp — acknowledged, ignored.');
      return { received: true };
    }

    const outcome = await this.tracking.applyCarrierUpdate(update);
    return { received: true, outcome };
  }

  private assertToken(presented: string | undefined): void {
    const expected = this.config.get<string>('SHIPROCKET_WEBHOOK_SECRET');
    if (!expected) {
      // Refuse rather than accept everything: an unset secret must never mean
      // an open endpoint that believes any POST claiming a delivery.
      this.logger.error('SHIPROCKET_WEBHOOK_SECRET is not set — rejecting carrier webhook.');
      throw new UnauthorizedException();
    }
    // Hash both sides so the comparison is fixed-length: timingSafeEqual
    // throws on unequal lengths, and a length check first would leak one.
    const digest = (value: string) => createHash('sha256').update(value).digest();
    if (!presented || !timingSafeEqual(digest(presented), digest(expected))) {
      throw new UnauthorizedException();
    }
  }
}
