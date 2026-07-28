import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  // Guards against the actual failure mode of a duplicate metric name:
  // prom-client throws at registration time, which would crash the whole
  // module on boot, not just the metrics feature.
  it('constructs without throwing and exposes a non-empty registry', async () => {
    expect(await service.registry.metrics()).toContain('# HELP');
  });

  it('exposes the request counter under its documented name', async () => {
    service.httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/products', status_code: '200' });
    const output = await service.registry.metrics();
    expect(output).toContain('http_requests_total');
  });

  it('exposes the payment and auth counters under their documented names', async () => {
    service.paymentEventsTotal.inc({ outcome: 'succeeded' });
    service.authFailuresTotal.inc();
    const output = await service.registry.metrics();
    expect(output).toContain('payment_events_total');
    expect(output).toContain('auth_failures_total');
  });

  it('includes default process/runtime metrics (heap, event loop, etc.)', async () => {
    const output = await service.registry.metrics();
    expect(output).toMatch(/process_cpu_user_seconds_total|nodejs_heap_size/);
  });
});
