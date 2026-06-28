import { CorrelationIdMiddleware } from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  it('generates a new correlation id when none was supplied', () => {
    const req = { headers: {} } as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-correlation-id']).toBeDefined();
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', req.headers['x-correlation-id']);
    expect(next).toHaveBeenCalled();
  });

  it('reuses an incoming correlation id rather than overwriting it', () => {
    const req = { headers: { 'x-correlation-id': 'client-supplied-id' } } as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-correlation-id']).toBe('client-supplied-id');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'client-supplied-id');
  });

  it('generates a new id when the incoming header is an empty string', () => {
    const req = { headers: { 'x-correlation-id': '' } } as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.headers['x-correlation-id']).not.toBe('');
  });

  it('always calls next()', () => {
    const req = { headers: {} } as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
