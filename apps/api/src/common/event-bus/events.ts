// Domain event payloads — ARCHITECTURE.md §5 names these events; BACKEND.md §4
// flagged that no event bus existed yet and services called each other
// directly instead. This is the typed contract for the in-process bus that
// closes that gap (see event-bus.service.ts).

export interface OrderConfirmedEvent {
  orderId: string;
  userEmail: string;
  totalMinorUnits: number;
}

// Payments owns the Payment aggregate only (Law 1 — no cross-module table
// writes) — it publishes this instead of writing Order's status directly.
// Orders owns the transition into CONFIRMED and re-publishes
// `order.confirmed` once its own state is updated.
export interface PaymentSucceededEvent {
  orderId: string;
  amountMinorUnits: number;
}

export interface ReturnRequestedEvent {
  returnId: string;
  userEmail: string;
  productName: string;
}

export interface ReturnRefundedEvent {
  returnId: string;
  userEmail: string;
  refundAmountMinorUnits: number;
}

// ProductUpserted/ProductDeleted, per ARCHITECTURE.md §5.3/§5.4 — the
// catalog-to-search sync this milestone implements. Carries only the id;
// the listener re-fetches current state from Postgres rather than trusting a
// possibly-stale payload, since multiple writers (Products, Reviews rating
// recompute) can trigger this for the same product in quick succession.
export interface ProductUpsertedEvent {
  productId: string;
}

export interface ProductDeletedEvent {
  productId: string;
}

// DOM-SHIPPING §5. Shipping never writes `orders` (Invariant 1) — Order moves
// itself on these. One payload shape for every carrier-driven status, since
// listeners key off the event name, not the payload.
export interface ShipmentStatusEvent {
  shipmentId: string;
  orderId: string;
  awbCode: string;
  occurredAt: Date;
}

export interface DomainEvents {
  'order.confirmed': OrderConfirmedEvent;
  'payment.succeeded': PaymentSucceededEvent;
  'return.requested': ReturnRequestedEvent;
  'return.refunded': ReturnRefundedEvent;
  'product.upserted': ProductUpsertedEvent;
  'product.deleted': ProductDeletedEvent;
  'shipment.picked_up': ShipmentStatusEvent;
  'shipment.in_transit': ShipmentStatusEvent;
  'shipment.out_for_delivery': ShipmentStatusEvent;
  'shipment.delivered': ShipmentStatusEvent;
  'shipment.ndr_raised': ShipmentStatusEvent;
  'shipment.rto_initiated': ShipmentStatusEvent;
}

export type DomainEventName = keyof DomainEvents;
