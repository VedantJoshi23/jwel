import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;
    const correlationId = headers['x-correlation-id'];
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          this.logger.log(
            `[${correlationId}] ${method} ${url} ${response.statusCode} +${Date.now() - startedAt}ms`,
          );
        },
        error: (err) => {
          this.logger.warn(
            `[${correlationId}] ${method} ${url} FAILED +${Date.now() - startedAt}ms: ${err.message}`,
          );
        },
      }),
    );
  }
}
