import { EventBusService } from './event-bus.service';

describe('EventBusService', () => {
  let bus: EventBusService;

  beforeEach(() => {
    bus = new EventBusService();
  });

  it('delivers an emitted event to a registered handler with the right payload', async () => {
    const handler = jest.fn();
    bus.on('order.confirmed', handler);
    bus.emit('order.confirmed', { orderId: '1', userEmail: 'a@b.com', totalMinorUnits: 1000 });

    // emit -> on dispatches via a microtask-wrapped async handler internally
    await new Promise(process.nextTick);
    expect(handler).toHaveBeenCalledWith({ orderId: '1', userEmail: 'a@b.com', totalMinorUnits: 1000 });
  });

  it('delivers an event to multiple independent handlers', async () => {
    const first = jest.fn();
    const second = jest.fn();
    bus.on('product.upserted', first);
    bus.on('product.upserted', second);
    bus.emit('product.upserted', { productId: 'p1' });

    await new Promise(process.nextTick);
    expect(first).toHaveBeenCalledWith({ productId: 'p1' });
    expect(second).toHaveBeenCalledWith({ productId: 'p1' });
  });

  it('a handler throwing does not propagate to the emitter and does not stop other handlers', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('boom'));
    const succeeding = jest.fn();
    bus.on('product.deleted', failing);
    bus.on('product.deleted', succeeding);

    expect(() => bus.emit('product.deleted', { productId: 'p1' })).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(succeeding).toHaveBeenCalled();
  });

  it('emitting an event with no registered handlers does not throw', () => {
    expect(() => bus.emit('return.requested', { returnId: '1', userEmail: 'a@b.com', productName: 'x' })).not.toThrow();
  });
});
