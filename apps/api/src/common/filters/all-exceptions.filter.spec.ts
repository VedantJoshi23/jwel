import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function buildHost(headers: Record<string, string> = {}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { headers, url: '/api/v1/test', method: 'GET' };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('maps an HttpException to its own status and message', () => {
    const { host, status, json } = buildHost();
    filter.catch(new NotFoundException('Product not found'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json.mock.calls[0][0]).toMatchObject({ statusCode: 404, message: 'Product not found' });
  });

  it('echoes back the x-correlation-id header when present', () => {
    const { host, json } = buildHost({ 'x-correlation-id': 'abc-123' });
    filter.catch(new BadRequestException('bad'), host);
    expect(json.mock.calls[0][0].correlationId).toBe('abc-123');
  });

  it('defaults correlationId to "unknown" when the header is absent', () => {
    const { host, json } = buildHost();
    filter.catch(new BadRequestException('bad'), host);
    expect(json.mock.calls[0][0].correlationId).toBe('unknown');
  });

  it('maps a known Prisma error code (P2002) to 409 Conflict', () => {
    const { host, status, json } = buildHost();
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    filter.catch(error, host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].message).toContain('already exists');
  });

  it('maps an unmapped Prisma error code to a generic 400', () => {
    const { host, status } = buildHost();
    const error = new Prisma.PrismaClientKnownRequestError('Some other error', {
      code: 'P9999',
      clientVersion: '5.0.0',
    });
    filter.catch(error, host);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('maps an unrecognized error to a generic 500 without leaking internal details', () => {
    const { host, status, json } = buildHost();
    filter.catch(new Error('some internal secret detail'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0].message).toBe('An unexpected error occurred');
  });

  it('includes the request path and an ISO timestamp in the envelope', () => {
    const { host, json } = buildHost();
    filter.catch(new NotFoundException('x'), host);
    const envelope = json.mock.calls[0][0];
    expect(envelope.path).toBe('/api/v1/test');
    expect(() => new Date(envelope.timestamp).toISOString()).not.toThrow();
  });
});
