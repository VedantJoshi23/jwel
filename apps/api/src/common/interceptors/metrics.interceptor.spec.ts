import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from '../../modules/metrics/metrics.service';

function buildContext(request: Record<string, unknown>, statusCode = 200) {
  const response = { statusCode };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
}

describe('MetricsInterceptor', () => {
  let metrics: { httpRequestsTotal: { inc: jest.Mock }; httpRequestDurationSeconds: { observe: jest.Mock } };
  let interceptor: MetricsInterceptor;

  beforeEach(() => {
    metrics = {
      httpRequestsTotal: { inc: jest.fn() },
      httpRequestDurationSeconds: { observe: jest.fn() },
    };
    interceptor = new MetricsInterceptor(metrics as unknown as MetricsService);
  });

  // The entire reason this file exists: a product/order/user id in the label
  // would create a new Prometheus time series per id, forever. The route
  // pattern is bounded and known ahead of time; the raw URL is not.
  it('labels with the route PATTERN, never the raw URL', (done) => {
    const request = { method: 'GET', route: { path: '/api/v1/products/:slug' }, url: '/api/v1/products/diamond-ring-abc123' };
    const next = { handle: () => of({}) };

    interceptor.intercept(buildContext(request, 200), next).subscribe(() => {
      const labels = metrics.httpRequestsTotal.inc.mock.calls[0][0];
      expect(labels.route).toBe('/api/v1/products/:slug');
      expect(labels.route).not.toContain('diamond-ring-abc123');
      done();
    });
  });

  // A type guard, not a real scenario: reaching this interceptor at all means
  // Nest already matched a route, so `request.route` is populated in every
  // real request (confirmed against a running instance). A URL with no
  // matching controller never reaches here — Express's platform layer 404s
  // it before Nest's interceptor chain runs, so that case is invisible to
  // this metric entirely, not represented by this test.
  it('falls back to a fixed label if request.route is ever missing', (done) => {
    const request = { method: 'GET', route: undefined, url: '/some/matched/path' };
    const next = { handle: () => of({}) };

    interceptor.intercept(buildContext(request, 200), next).subscribe(() => {
      const labels = metrics.httpRequestsTotal.inc.mock.calls[0][0];
      expect(labels.route).toBe('unmatched');
      done();
    });
  });

  it('records both the counter and the duration histogram with matching labels', (done) => {
    const request = { method: 'POST', route: { path: '/api/v1/orders' } };
    const next = { handle: () => of({}) };

    interceptor.intercept(buildContext(request, 201), next).subscribe(() => {
      const counterLabels = metrics.httpRequestsTotal.inc.mock.calls[0][0];
      const [histLabels, duration] = metrics.httpRequestDurationSeconds.observe.mock.calls[0];
      expect(counterLabels).toEqual(histLabels);
      expect(counterLabels.status_code).toBe('201');
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
      done();
    });
  });

  // AllExceptionsFilter decides the client-visible status later in the
  // pipeline; this interceptor sees the exception directly and must read the
  // status off it, or every thrown error — including ordinary 404s — would
  // be recorded as a 500.
  it('records the thrown exception’s own status code, not a hardcoded 500', (done) => {
    const request = { method: 'GET', route: { path: '/api/v1/products/:slug' } };
    const next = { handle: () => throwError(() => new NotFoundException('Product not found')) };

    interceptor.intercept(buildContext(request), next).subscribe({
      error: () => {
        const labels = metrics.httpRequestsTotal.inc.mock.calls[0][0];
        expect(labels.status_code).toBe('404');
        done();
      },
    });
  });

  it('records 500 for a plain thrown Error with no getStatus method', (done) => {
    const request = { method: 'GET', route: { path: '/api/v1/orders' } };
    const next = { handle: () => throwError(() => new Error('boom')) };

    interceptor.intercept(buildContext(request), next).subscribe({
      error: () => {
        const labels = metrics.httpRequestsTotal.inc.mock.calls[0][0];
        expect(labels.status_code).toBe('500');
        done();
      },
    });
  });
});
