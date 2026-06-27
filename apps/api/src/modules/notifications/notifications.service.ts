import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { formatMinorUnitsForEmail } from './format-money';

/**
 * Resend integration, graceful-degradation variant — unlike Payments (which
 * must fail loudly if Razorpay is invoked without activation, SECURITY.md
 * §4), a failed or skipped notification must never break the business
 * operation that triggered it. No RESEND_API_KEY configured -> log and skip,
 * not throw. This is deliberately the opposite failure posture from the
 * Payments stub, for a deliberately different reason: payments touch money
 * and must be visibly wrong if misconfigured; notifications are best-effort.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resendApiKey?: string;

  constructor(
    private readonly eventBus: EventBusService,
    config: ConfigService,
  ) {
    this.resendApiKey = config.get<string>('RESEND_API_KEY');
  }

  onModuleInit(): void {
    this.eventBus.on('order.confirmed', (payload) =>
      this.send(
        payload.userEmail,
        'Your Jwel order is confirmed',
        `Order ${payload.orderId} is confirmed — total ${formatMinorUnitsForEmail(payload.totalMinorUnits)}.`,
      ),
    );
    this.eventBus.on('return.requested', (payload) =>
      this.send(
        payload.userEmail,
        'We received your return request',
        `We've received your return request for ${payload.productName}. We'll email you once it's reviewed.`,
      ),
    );
    this.eventBus.on('return.refunded', (payload) =>
      this.send(
        payload.userEmail,
        'Your refund has been processed',
        `A refund of ${formatMinorUnitsForEmail(payload.refundAmountMinorUnits)} has been issued for return ${payload.returnId}.`,
      ),
    );
  }

  private async send(to: string, subject: string, body: string): Promise<void> {
    if (!this.resendApiKey) {
      this.logger.warn(`RESEND_API_KEY not configured — skipping email "${subject}" to ${to}`);
      return;
    }
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: 'Jwel <orders@jwel.example>', to, subject, text: body }),
      });
    } catch (error) {
      this.logger.error(`Failed to send email "${subject}" to ${to}`, error as Error);
    }
  }
}
