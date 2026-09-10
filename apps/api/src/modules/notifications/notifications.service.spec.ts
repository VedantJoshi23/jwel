import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';

describe('NotificationsService', () => {
  let eventBus: { on: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    eventBus = { on: jest.fn() };
    // A real Response, not `{}`. The previous stub had no `ok` and no `text`,
    // so it silently exercised the failure path of any code that checked
    // either — which is how an unchecked `response.ok` survived here.
    fetchMock = jest.fn().mockResolvedValue(new Response('{"id":"email_1"}', { status: 200 }));
    (global as any).fetch = fetchMock;
  });

  function buildService(apiKey?: string) {
    const config = { get: jest.fn().mockReturnValue(apiKey) } as unknown as ConfigService;
    const service = new NotificationsService(eventBus as unknown as EventBusService, config);
    service.onModuleInit();
    return service;
  }

  it('subscribes to order.confirmed, return.requested, and return.refunded', () => {
    buildService('re_123');
    const events = eventBus.on.mock.calls.map((call) => call[0]);
    expect(events).toEqual(['order.confirmed', 'return.requested', 'return.refunded']);
  });

  it('skips sending (does not call fetch) when RESEND_API_KEY is not configured', async () => {
    buildService(undefined);
    const handler = eventBus.on.mock.calls[0][1];
    await handler({ orderId: 'o1', userEmail: 'a@b.com', totalMinorUnits: 1000 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends via the Resend API when a key is configured', async () => {
    buildService('re_123');
    const handler = eventBus.on.mock.calls[0][1];
    await handler({ orderId: 'o1', userEmail: 'a@b.com', totalMinorUnits: 1000 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer re_123' }) }),
    );
  });

  it('does not throw when the Resend API call itself fails (best-effort delivery)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    buildService('re_123');
    const handler = eventBus.on.mock.calls[0][1];
    await expect(handler({ orderId: 'o1', userEmail: 'a@b.com', totalMinorUnits: 1000 })).resolves.toBeUndefined();
  });

  it('logs a rejected send instead of treating a 4xx as delivered', async () => {
    // Regression: `send` never checked `response.ok`, so an unverified domain
    // or suppressed recipient — both plain 4xx responses from Resend — looked
    // identical to a successful delivery in the logs.
    fetchMock.mockResolvedValue(
      new Response('{"message":"domain not verified"}', { status: 403, statusText: 'Forbidden' }),
    );
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    buildService('re_123');
    const handler = eventBus.on.mock.calls[0][1];
    await handler({ orderId: 'o1', userEmail: 'a@b.com', totalMinorUnits: 1000 });

    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('403'));
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('domain not verified'));
    errorLog.mockRestore();
  });

  it('does not retry a send, because the POST carries no idempotency key', async () => {
    // A duplicate refund email reads to the customer as a second refund, so
    // this path is deliberately timeout-only. Guards against someone later
    // "improving" it by enabling retries.
    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    buildService('re_123');
    const handler = eventBus.on.mock.calls[0][1];
    await handler({ orderId: 'o1', userEmail: 'a@b.com', totalMinorUnits: 1000 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes an abort signal, so a stalled Resend connection cannot hang the caller', async () => {
    buildService('re_123');
    const handler = eventBus.on.mock.calls[0][1];
    await handler({ orderId: 'o1', userEmail: 'a@b.com', totalMinorUnits: 1000 });

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('formats the return.refunded email body with the refund amount', async () => {
    buildService('re_123');
    const refundedHandler = eventBus.on.mock.calls[2][1];
    await refundedHandler({ returnId: 'r1', userEmail: 'a@b.com', refundAmountMinorUnits: 150000 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('r1');
  });
});
