import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { resilientFetch } from '../../common/http/resilient-fetch';
import { formatMinorUnitsForEmail } from './format-money';

const ADMIN_EMAIL = 'admin@elysianjewellers.com';

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
        'Your ELYSIAN order is confirmed',
        `Order ${payload.orderId} is confirmed — total ${formatMinorUnitsForEmail(payload.totalMinorUnits)}.`,
      ),
    );
    this.eventBus.on('return.requested', (payload) => {
      this.send(
        payload.userEmail,
        'We received your return request',
        `We've received your return request for ${payload.productName}. We'll email you once it's reviewed.`,
      );
      // Refund lifecycle starts here, not at return.refunded — a return sits
      // in REQUESTED until staff reviews it (returns.service.ts
      // adminUpdateStatus), so admin@ needs to hear about it at the moment
      // that review becomes necessary, not only once money has already moved.
      this.send(
        ADMIN_EMAIL,
        'New return request — action needed',
        `Return ${payload.returnId} requested for ${payload.productName}. Review it in the admin panel.`,
      );
    });
    this.eventBus.on('return.refunded', (payload) => {
      this.send(
        payload.userEmail,
        'Your refund has been processed',
        `A refund of ${formatMinorUnitsForEmail(payload.refundAmountMinorUnits)} has been issued for return ${payload.returnId}.`,
      );
      this.send(
        ADMIN_EMAIL,
        'Refund completed',
        `Refund of ${formatMinorUnitsForEmail(payload.refundAmountMinorUnits)} completed for return ${payload.returnId}.`,
      );
    });
  }

  private async send(to: string, subject: string, body: string): Promise<void> {
    if (!this.resendApiKey) {
      this.logger.warn(`RESEND_API_KEY not configured — skipping email "${subject}" to ${to}`);
      return;
    }
    try {
      // Deliberately not retried. This POST is not idempotent and carries no
      // idempotency key, so a retry risks the customer receiving the same
      // refund or order email twice — worse than not receiving it, since a
      // duplicate refund notice reads as a second refund. The timeout is the
      // part that matters here: Node's fetch has none, so a stalled Resend
      // connection previously held this call open indefinitely.
      const response = await resilientFetch('https://api.resend.com/emails', {
        method: 'POST',
        retries: 0,
        timeoutMs: 5_000,
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'ELYSIAN <orders@elysianjewellers.com>',
          // Customer replies to a transactional email should land in a
          // monitored inbox, not bounce off the send-only orders@ address.
          reply_to: 'support@elysianjewellers.com',
          to,
          subject,
          text: body,
        }),
      });

      // Previously unchecked: a rejected send (bad key, unverified domain,
      // suppressed recipient) returns a 4xx that this method swallowed, so
      // every delivery failure looked like a success in the logs.
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        this.logger.error(
          `Resend rejected email "${subject}" to ${to}: ${response.status} ${response.statusText} ${detail}`.trim(),
        );
      }
    } catch (error) {
      this.logger.error(`Failed to send email "${subject}" to ${to}`, error as Error);
    }
  }
}
