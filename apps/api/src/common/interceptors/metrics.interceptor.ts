import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../../modules/metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method } = request;
    const startedAt = process.hrtime.bigint();

    const record = (statusCode: number) => {
      // `request.route.path`, never `request.url` — Nest registers routes
      // using the literal decorated path (`/api/v1/products/:slug`), which
      // Express exposes back here once the handler has matched. The raw URL
      // has a real value per product/order/user id in it; using it as a
      // label would mean a new Prometheus time series per id, forever — the
      // exact cardinality blow-up this file exists to avoid.
      //
      // The `?? 'unmatched'` fallback is a type guard, not a real code path:
      // reaching this interceptor at all means a Nest route already matched,
      // so `request.route` is always populated here in practice — verified
      // against a running instance, not assumed. A request to a URL with no
      // matching controller (a genuine 404) never enters the interceptor
      // chain at all and is invisible to this metric entirely; Express's
      // platform layer rejects it before Nest's DI-based pipeline runs.
      const route = request.route?.path ?? 'unmatched';
      const labels = { method, route, status_code: String(statusCode) };
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;

      this.metrics.httpRequestsTotal.inc(labels);
      this.metrics.httpRequestDurationSeconds.observe(labels, durationSeconds);
    };

    return next.handle().pipe(
      tap({
        next: () => record(context.switchToHttp().getResponse().statusCode),
        // AllExceptionsFilter runs after this interceptor's error handler,
        // so the real status code (404/400/500/...) isn't decided yet here.
        // Recording under the exception's own status when it's an HttpException
        // keeps this metric consistent with what the client actually receives,
        // rather than every thrown error being counted as a 500.
        error: (err) => record(typeof err?.getStatus === 'function' ? err.getStatus() : 500),
      }),
    );
  }
}
