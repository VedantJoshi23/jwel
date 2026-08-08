import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

/**
 * Reports a condition an operator needs to know about *now*, to both the log
 * and Sentry.
 *
 * `logger.error` alone is not an alert. Nothing watches the container log, so
 * a message written there is found only by someone already looking — which is
 * to say, after a customer complained. `AllExceptionsFilter` is the only thing
 * currently reaching Sentry, and it only sees thrown exceptions on a request
 * path. A background sweep that quietly repairs data throws nothing and is
 * invisible to it.
 *
 * `DOM-ORDERING`: *"The sweep must alert when it finds anything. A sweep that
 * silently fixes things conceals the bug that made fixing necessary."* This is
 * that alert.
 *
 * Absent `SENTRY_DSN` the Sentry call is a documented no-op (`instrument.ts`),
 * so this degrades to logging rather than failing — a deployment without a
 * Sentry project behaves exactly as before.
 */
export function alertOperator(
  logger: Logger,
  message: string,
  context: Record<string, string> = {},
): void {
  logger.error(message);
  Sentry.captureMessage(message, { level: 'error', tags: context });
}
