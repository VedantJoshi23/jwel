import { Injectable, Logger } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import type { DomainEventName } from '../../common/event-bus/events';
import { CarrierUpdate, mapShiprocketStatus } from './providers/shiprocket-webhook';

export type TrackingOutcome =
  | 'applied'
  | 'unknown_awb'
  | 'unmapped_status'
  | 'no_change'
  | 'stale'
  | 'terminal';

const TERMINAL: ShipmentStatus[] = [ShipmentStatus.DELIVERED, ShipmentStatus.RTO_DELIVERED, ShipmentStatus.CANCELLED];

// DOM-SHIPPING §5. RTO_DELIVERED and CANCELLED have no event there yet —
// their consumers (RTO restock, Phase 4; order cancellation, Phase 2) will
// add one alongside the listener that needs it, rather than publishing into
// nothing now.
const EVENT_FOR: Partial<Record<ShipmentStatus, DomainEventName>> = {
  [ShipmentStatus.PICKED_UP]: 'shipment.picked_up',
  [ShipmentStatus.IN_TRANSIT]: 'shipment.in_transit',
  [ShipmentStatus.OUT_FOR_DELIVERY]: 'shipment.out_for_delivery',
  [ShipmentStatus.DELIVERED]: 'shipment.delivered',
  [ShipmentStatus.NDR]: 'shipment.ndr_raised',
  [ShipmentStatus.RTO_INITIATED]: 'shipment.rto_initiated',
};

/**
 * Applies a carrier status report to a shipment. Shared by the webhook and,
 * in a later phase, by polling reconciliation — both are just sources of the
 * same `CarrierUpdate`, so they must obey the same ordering rules.
 *
 * Ordering is by the carrier's event time, not by a status rank
 * (DOM-SHIPPING Edge Case 2): NDR → OUT_FOR_DELIVERY is a legitimate
 * re-attempt, so "never move backwards" cannot be expressed as a ranking.
 * What IS fixed: nothing leaves a terminal state, an RTO never returns to the
 * forward path, and an event at or before the last applied one is ignored.
 */
@Injectable()
export class ShipmentTrackingService {
  private readonly logger = new Logger(ShipmentTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async applyCarrierUpdate(update: CarrierUpdate): Promise<TrackingOutcome> {
    const shipment = await this.prisma.shipment.findUnique({ where: { awbCode: update.awbCode } });
    if (!shipment) {
      // Expected, not an error: Shiprocket's "Test Webhook" sends a sample AWB,
      // and the account may carry shipments this system never created.
      this.logger.log(`Carrier update for unknown AWB ${update.awbCode} ("${update.rawStatus}") — acknowledged, ignored.`);
      return 'unknown_awb';
    }

    const next = mapShiprocketStatus(update.rawStatus);
    if (next === undefined) {
      // Warn, not log: an unmapped status could be one that matters (lost,
      // damaged). Reconciliation will not fix this — the mapping needs a line.
      this.logger.warn(
        `Unrecognised carrier status "${update.rawStatus}" for AWB ${update.awbCode} (shipment ${shipment.id}) — not applied.`,
      );
      return 'unmapped_status';
    }

    if (TERMINAL.includes(shipment.status)) return 'terminal';
    if (shipment.lastEventAt && update.occurredAt <= shipment.lastEventAt) return 'stale';
    if (next === null || next === shipment.status) return 'no_change';
    if (shipment.status === ShipmentStatus.RTO_INITIATED && next !== ShipmentStatus.RTO_DELIVERED) {
      return 'no_change';
    }

    // The checks above read a snapshot; this conditional write is what makes
    // them hold under two webhooks for the same shipment arriving together.
    const applied = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.shipment.updateMany({
        where: {
          id: shipment.id,
          status: { notIn: TERMINAL },
          OR: [{ lastEventAt: null }, { lastEventAt: { lt: update.occurredAt } }],
        },
        data: {
          status: next,
          lastEventAt: update.occurredAt,
          ...(update.courierName ? { courierName: update.courierName } : {}),
          ...(update.estimatedDelivery ? { estimatedDelivery: update.estimatedDelivery } : {}),
        },
      });
      if (count === 0) return false;

      await tx.shipmentStatusHistory.create({
        data: { shipmentId: shipment.id, status: next, note: update.rawStatus, occurredAt: update.occurredAt },
      });
      return true;
    });
    if (!applied) return 'stale';

    // Published after commit, never inside the transaction: a listener must
    // not observe a status that could still roll back.
    const event = EVENT_FOR[next];
    if (event) {
      this.eventBus.emit(event, {
        shipmentId: shipment.id,
        orderId: shipment.orderId,
        awbCode: update.awbCode,
        occurredAt: update.occurredAt,
      });
    }
    return 'applied';
  }
}
