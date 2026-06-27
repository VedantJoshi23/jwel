// Domain event payloads — ARCHITECTURE.md §5 names these events; BACKEND.md §4
// flagged that no event bus existed yet and services called each other
// directly instead. This is the typed contract for the in-process bus that
// closes that gap (see event-bus.service.ts).

export interface OrderConfirmedEvent {
  orderId: string;
  userEmail: string;
  totalMinorUnits: number;
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

export interface DomainEvents {
  'order.confirmed': OrderConfirmedEvent;
  'return.requested': ReturnRequestedEvent;
  'return.refunded': ReturnRefundedEvent;
  'product.upserted': ProductUpsertedEvent;
  'product.deleted': ProductDeletedEvent;
}

export type DomainEventName = keyof DomainEvents;
