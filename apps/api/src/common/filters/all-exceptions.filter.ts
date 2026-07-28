import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

interface ErrorEnvelope {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  correlationId: string;
  timestamp: string;
}

const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'A record with this value already exists' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'The requested record was not found' },
  P2003: { status: HttpStatus.CONFLICT, message: 'This action violates a related record constraint' },
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request.headers['x-correlation-id'] as string) ?? 'unknown';

    const { status, error, message } = this.resolve(exception);

    const envelope: ErrorEnvelope = {
      statusCode: status,
      error,
      message,
      path: request.url,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} -> ${status}: ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );

      // Only 5xx — a 404 or a validation 400 is not a bug report, it's normal
      // traffic, and reporting every one of them would drown the real signal.
      // `correlationId` is attached as a tag (not just in `extra`) so it is
      // searchable in Sentry's UI, matching ADR-0002's requirement that a
      // single request be traceable across logs, metrics, and error reports.
      // A no-op when SENTRY_DSN is unset (see instrument.ts).
      Sentry.captureException(exception, { tags: { correlationId } });
    } else {
      this.logger.warn(`[${correlationId}] ${request.method} ${request.url} -> ${status}: ${JSON.stringify(message)}`);
    }

    response.status(status).json(envelope);
  }

  private resolve(exception: unknown): { status: number; error: string; message: string | string[] } {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as any).message ?? exception.message;
      return { status: exception.getStatus(), error: exception.name, message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_ERROR_MAP[exception.code];
      if (mapped) {
        return { status: mapped.status, error: 'PrismaKnownRequestError', message: mapped.message };
      }
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'PrismaKnownRequestError',
        message: 'The request could not be processed due to a data constraint',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    };
  }
}
