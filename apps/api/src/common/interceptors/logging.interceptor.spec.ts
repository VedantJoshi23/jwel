import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

function buildContext(statusCode = 200) {
  const request = { method: 'GET', url: '/api/v1/test', headers: { 'x-correlation-id': 'abc' } };
  const response = { statusCode };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
}

describe('LoggingInterceptor', () => {
  const interceptor = new LoggingInterceptor();

  it('passes through a successful response unchanged', (done) => {
    const handler: CallHandler = { handle: () => of({ ok: true }) };
    interceptor.intercept(buildContext(), handler).subscribe((result) => {
      expect(result).toEqual({ ok: true });
      done();
    });
  });

  it('propagates an error from the handler rather than swallowing it', (done) => {
    const handler: CallHandler = { handle: () => throwError(() => new Error('boom')) };
    interceptor.intercept(buildContext(), handler).subscribe({
      error: (err) => {
        expect(err.message).toBe('boom');
        done();
      },
    });
  });
});
