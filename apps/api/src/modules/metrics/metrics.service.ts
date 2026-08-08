import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Single Registry for the whole process. Metric objects are created once at
 * construction (Prometheus client conventions — creating a new Counter per
 * request would register a duplicate and throw) and mutated by whichever
 * caller observed the event; `MetricsController` reads the same registry back
 * out at scrape time.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests, labeled by route pattern, method, and status code',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });

  readonly httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds, labeled by route pattern, method, and status code',
    labelNames: ['method', 'route', 'status_code'],
    // Tuned for a request/response API, not a batch job — the buckets below
    // 1s are where checkout/payment latency actually needs resolution.
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  // Named for what SECURITY.md §A09 and STD-OBSERVABILITY already promise an
  // alert on: auth failure-rate and checkout (payment) error-rate spikes.
  readonly authFailuresTotal = new Counter({
    name: 'auth_failures_total',
    help: 'Failed login attempts (invalid email or password)',
    registers: [this.registry],
  });

  readonly paymentEventsTotal = new Counter({
    name: 'payment_events_total',
    help: 'Payment outcomes, labeled by result',
    labelNames: ['outcome'],
    registers: [this.registry],
  });

  /**
   * Orders the reconciliation sweep had to fix (DOM-ORDERING invariants 11 and
   * 12), labeled by which half acted.
   *
   * `confirmed` is the one to alert on: it counts orders that were **paid but
   * never confirmed**, which only happens when the reaction to
   * `payment.succeeded` was lost. Every increment is a bug that already
   * charged a customer.
   *
   * `expired` is ordinary abandoned-checkout traffic and is a rate to watch,
   * not an alarm.
   */
  readonly orderReconciliationTotal = new Counter({
    name: 'order_reconciliation_total',
    help: 'Orders repaired by the reconciliation sweep, labeled by outcome',
    labelNames: ['outcome'],
    registers: [this.registry],
  });

  constructor() {
    // Process/runtime metrics (heap, event loop lag, GC, open handles) —
    // free from prom-client, and the first thing anyone reaches for when
    // "is the API healthy" turns out to mean "is it about to fall over".
    collectDefaultMetrics({ register: this.registry });
  }
}
