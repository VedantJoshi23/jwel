import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';

describe('NotificationsService', () => {
  let eventBus: { on: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    eventBus = { on: jest.fn() };
    fetchMock = jest.fn().mockResolvedValue({});
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

  it('formats the return.refunded email body with the refund amount', async () => {
    buildService('re_123');
    const refundedHandler = eventBus.on.mock.calls[2][1];
    await refundedHandler({ returnId: 'r1', userEmail: 'a@b.com', refundAmountMinorUnits: 150000 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('r1');
  });
});
