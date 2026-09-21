import { ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { ShipmentTrackingService } from './shipment-tracking.service';
import { CarrierUpdate } from './providers/shiprocket-webhook';

const T0 = new Date('2026-09-20T10:00:00Z');
const LATER = new Date('2026-09-20T12:00:00Z');

function update(overrides: Partial<CarrierUpdate> = {}): CarrierUpdate {
  return {
    awbCode: 'AWB1',
    rawStatus: 'In Transit',
    occurredAt: LATER,
    courierName: 'Delhivery',
    estimatedDelivery: null,
    ...overrides,
  };
}

function shipment(overrides: Record<string, unknown> = {}) {
  return { id: 's1', orderId: 'o1', awbCode: 'AWB1', status: ShipmentStatus.PICKED_UP, lastEventAt: T0, ...overrides };
}

/** DOM-SHIPPING Edge Case 2, and ADR-0029's unknown-AWB rule. */
describe('ShipmentTrackingService', () => {
  let tx: { shipment: { updateMany: jest.Mock }; shipmentStatusHistory: { create: jest.Mock } };
  let prisma: { shipment: { findUnique: jest.Mock }; $transaction: jest.Mock };
  let eventBus: { emit: jest.Mock };
  let service: ShipmentTrackingService;

  beforeEach(() => {
    tx = {
      shipment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      shipmentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      shipment: { findUnique: jest.fn().mockResolvedValue(shipment()) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    eventBus = { emit: jest.fn() };
    service = new ShipmentTrackingService(prisma as unknown as PrismaService, eventBus as unknown as EventBusService);
  });

  it('applies a newer status: updates the shipment, records history with the raw text, then publishes', async () => {
    await expect(service.applyCarrierUpdate(update())).resolves.toBe('applied');

    expect(tx.shipment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 's1',
        status: { notIn: [ShipmentStatus.DELIVERED, ShipmentStatus.RTO_DELIVERED, ShipmentStatus.CANCELLED] },
        OR: [{ lastEventAt: null }, { lastEventAt: { lt: LATER } }],
      },
      data: { status: ShipmentStatus.IN_TRANSIT, lastEventAt: LATER, courierName: 'Delhivery' },
    });
    expect(tx.shipmentStatusHistory.create).toHaveBeenCalledWith({
      data: { shipmentId: 's1', status: ShipmentStatus.IN_TRANSIT, note: 'In Transit', occurredAt: LATER },
    });
    expect(eventBus.emit).toHaveBeenCalledWith('shipment.in_transit', {
      shipmentId: 's1',
      orderId: 'o1',
      awbCode: 'AWB1',
      occurredAt: LATER,
    });
  });

  it('acknowledges an unknown AWB without touching anything (Shiprocket Test Webhook)', async () => {
    prisma.shipment.findUnique.mockResolvedValue(null);

    await expect(service.applyCarrierUpdate(update({ awbCode: '59629792084' }))).resolves.toBe('unknown_awb');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('ignores a duplicate — same event time as the last applied one', async () => {
    await expect(service.applyCarrierUpdate(update({ occurredAt: T0 }))).resolves.toBe('stale');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ignores an out-of-order older event, even one that looks like progress', async () => {
    const earlier = new Date('2026-09-20T09:00:00Z');
    await expect(service.applyCarrierUpdate(update({ rawStatus: 'Delivered', occurredAt: earlier }))).resolves.toBe('stale');
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it.each([[ShipmentStatus.DELIVERED], [ShipmentStatus.RTO_DELIVERED], [ShipmentStatus.CANCELLED]])(
    'never moves a shipment out of terminal %s',
    async (status) => {
      prisma.shipment.findUnique.mockResolvedValue(shipment({ status }));
      await expect(service.applyCarrierUpdate(update({ rawStatus: 'Out For Delivery' }))).resolves.toBe('terminal');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('allows NDR → OUT_FOR_DELIVERY — a re-attempt is not a regression', async () => {
    prisma.shipment.findUnique.mockResolvedValue(shipment({ status: ShipmentStatus.NDR }));
    await expect(service.applyCarrierUpdate(update({ rawStatus: 'Out For Delivery' }))).resolves.toBe('applied');
    expect(eventBus.emit).toHaveBeenCalledWith('shipment.out_for_delivery', expect.anything());
  });

  it('keeps an RTO off the forward path, but lets it complete', async () => {
    prisma.shipment.findUnique.mockResolvedValue(shipment({ status: ShipmentStatus.RTO_INITIATED }));
    await expect(service.applyCarrierUpdate(update({ rawStatus: 'Out For Delivery' }))).resolves.toBe('no_change');

    await expect(service.applyCarrierUpdate(update({ rawStatus: 'RTO Delivered' }))).resolves.toBe('applied');
    // No event for RTO_DELIVERED yet — its consumer arrives in a later phase.
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('treats pre-pickup chatter and a repeat of the current status as no change', async () => {
    await expect(service.applyCarrierUpdate(update({ rawStatus: 'Pickup Scheduled' }))).resolves.toBe('no_change');
    await expect(service.applyCarrierUpdate(update({ rawStatus: 'Picked Up' }))).resolves.toBe('no_change');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reports an unrecognised status and applies nothing', async () => {
    await expect(service.applyCarrierUpdate(update({ rawStatus: 'Lost' }))).resolves.toBe('unmapped_status');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('applies to a shipment with no prior event time', async () => {
    prisma.shipment.findUnique.mockResolvedValue(shipment({ status: ShipmentStatus.CREATED, lastEventAt: null }));
    await expect(service.applyCarrierUpdate(update({ rawStatus: 'Picked Up' }))).resolves.toBe('applied');
    expect(eventBus.emit).toHaveBeenCalledWith('shipment.picked_up', expect.anything());
  });

  it('loses a race cleanly: the conditional write matches nothing, so no history and no event', async () => {
    tx.shipment.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.applyCarrierUpdate(update())).resolves.toBe('stale');
    expect(tx.shipmentStatusHistory.create).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('records the ETD and keeps an existing courier name when the carrier sends none', async () => {
    const etd = new Date('2026-09-23T00:00:00Z');
    await service.applyCarrierUpdate(update({ courierName: null, estimatedDelivery: etd }));
    expect(tx.shipment.updateMany.mock.calls[0][0].data).toEqual({
      status: ShipmentStatus.IN_TRANSIT,
      lastEventAt: LATER,
      estimatedDelivery: etd,
    });
  });
});
