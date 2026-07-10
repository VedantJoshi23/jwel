---
id: DOM-SHIPPING
title: Jwel — Domain: Shipping
version: 0.1.0
status: Proposal
owner: Architecture
reviewers: []
created: 2026-07-09
updated: 2026-07-09
milestone: M5
category: Domains
priority: High
depends_on:
  - ADR-0001
required_by:
  - FEAT-SHIPPING
related_documents: []
related_domains: []
related_features: []
related_decisions:
  - ADR-0001
tags:
  - domain
  - shipping
risk: High
complexity: High
---

# Domain: Shipping

**Tier:** Full — owns real data (shipments, tracking events, COD ledger)
and several invariants of its own; not a derived projection of another
domain.

## 1. Overview

Owns the lifecycle of a physical shipment from creation through delivery
(or return-to-origin): checkout-time serviceability/COD-eligibility
checks, shipment/AWB creation with the carrier aggregator (Shiprocket,
per `ADR-0001`), consuming carrier webhook events, non-delivery (NDR) and
return-to-origin (RTO) handling, and COD remittance reconciliation. It
requests Order status transitions rather than performing them.

## 2. Ownership

### Owns

- Shipment records (carrier, AWB number, status, tracking URL, estimated
  delivery) — one per Order, created once the order enters fulfillment.
- Shipment status history (mirrors `OrderStatusHistory`'s pattern).
- Serviceability results (per-pincode COD eligibility, estimated
  delivery window) — read-through cache of Shiprocket's own lookup, not
  a permanent system of record.
- COD remittance ledger entries (Shiprocket remits COD cash on a delay;
  this is not the same as `Payment.status`, since COD isn't "paid" from
  jwel's perspective until remitted).

### Explicitly Does NOT Own

*(restated from `ARCHITECTURE.md` §3's Service Boundaries table)*

- Order lifecycle/status itself — Shipping only ever requests a
  transition via an event Order listens for and applies (see §5, §7).
- Payment status — COD remittance affects bookkeeping, not
  `Payment.status`, which Payments alone owns.
- Inventory stock levels — an RTO triggers a restock request to
  Inventory, the same way Returns already does; Shipping doesn't touch
  `inventory_items` directly.

## 3. Invariants

### Invariant 1

> Shipping never writes `orders.status` directly. It publishes an event
> (`ShipmentDelivered`, `ShipmentRtoInitiated`, etc.); Order alone applies
> the resulting transition.

**Source:** `ARCHITECTURE.md` §3's cross-module communication rule ("never
by importing another module's repository or entity directly") — the same
boundary the Payments→Order direct-write bug violated and was fixed for
(see the M8 implementation audit). Applying that same rule to a brand-new
domain from the start, not after a bug is found this time.

### Invariant 2

> A serviceability check (pincode + COD eligibility) happens before
> payment method is offered at checkout — COD must not be presented as an
> option for an unserviceable or COD-ineligible pincode.

**Source:** `PRODUCT.md` FR-9 (Checkout: "shipping method selection")
combined with the COD-fraud reasoning already raised for this domain
(new decision, this spec) — presenting an option that will fail at
fulfillment time is worse than not offering it.

### Invariant 3

> Every shipment above ₹50,000 declared value must carry Shiprocket's
> per-shipment insurance; shipments at or below that threshold may ship
> uninsured.

**Source:** New decision, this domain spec. Rationale: jewellery AOV is
high enough that uninsured high-value shipments are a real,
unbounded loss exposure; a flat threshold (revisit once real claims data
exists) is simpler to reason about and audit than a percentage-of-order
rule.

### Invariant 4

> COD is disabled for orders above ₹25,000, and for any customer account
> with no previously delivered order (COD is available only to
> "COD-proven" customers past that value, or first-time customers below
> it).

**Source:** New decision, this domain spec. Rationale: COD is the primary
fraud vector named in the earlier Shiprocket-integration discussion
("order-and-reject," fake addresses) — a value cap plus a first-order
restriction is a common, low-friction mitigation that doesn't require
building a full risk-scoring system for MVP.

### Invariant 5

> A non-delivery report (NDR) must be resolved (reattempt scheduled or
> return-to-origin confirmed) within the carrier's SLA window (modeled as
> 48 hours) — an unresolved NDR past that window auto-escalates to the
> admin queue as overdue, it does not silently expire.

**Source:** New decision, this domain spec, informed by Shiprocket's own
documented NDR workflow. The 48h figure is a starting heuristic (flagged
in §9 Open Questions), not derived from jwel's own operational data,
which doesn't exist yet.

## 4. API Surface

- `GET /api/v1/shipping/serviceability?pincode=...&codRequested=...` —
  public, used at checkout before payment method selection.
- `GET /api/v1/orders/:id/tracking` — customer-facing tracking detail
  (carrier, AWB, status timeline, estimated delivery); a thin read over
  Shipping's own data, exposed through Order's existing
  `GET /api/v1/orders/:id` surface or as its own endpoint (implementation
  choice for `FEAT-SHIPPING` §4, not fixed here).
- `POST /api/v1/shipping/webhooks/shiprocket` — signed server-to-server
  callback (same pattern as `POST /api/v1/payments/webhook/stripe`), not
  part of the public API surface.
- `GET /api/v1/admin/shipments` / `GET /api/v1/admin/shipments/:id` —
  admin shipment list/detail, including NDR queue.
- `POST /api/v1/admin/shipments/:id/ndr-decision` — admin resolves an NDR
  (reattempt or confirm RTO).

## 5. Events

### Publishes

`ShipmentCreated`, `ShipmentPickedUp`, `ShipmentInTransit`,
`ShipmentOutForDelivery`, `ShipmentDelivered`, `ShipmentNdrRaised`,
`ShipmentRtoInitiated`, `CodRemittanceReceived` — per
`ARCHITECTURE.md` §5.4's Domain Events Catalog.

### Consumes

None inbound — Shipping is triggered by a direct call (Order calling
`createShipment`), not by listening for an Order event. (This asymmetry —
Shipping is called by Order but talks back only via events, never a
direct call into Order — is deliberate: it's the same one-way event
discipline Payments now follows after the M8 audit fix, applied here from
first design rather than retrofitted.)

## 6. Data Ownership

New tables (all new, no existing table's ownership changes):

- `shipments` — `id`, `orderId` (unique FK to `orders`), `provider`
  (enum, `SHIPROCKET` today), `awbNumber`, `courierName`, `status`
  (enum: `CREATED`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`,
  `DELIVERED`, `NDR`, `RTO_INITIATED`, `RTO_DELIVERED`), `insured`
  (boolean), `estimatedDelivery`, `trackingUrl`, `createdAt`, `updatedAt`.
- `shipment_status_history` — mirrors `order_status_history`'s shape:
  `id`, `shipmentId`, `status`, `note`, `occurredAt`.
- `cod_remittances` — `id`, `shipmentId`, `amountMinorUnits`,
  `remittedAt`, `providerRef`.

`shipments.orderId` is a cross-context foreign key to `orders` (read
reference only) — per the M8 audit's correction to `STD-DATABASE`, this
is fine; the boundary rule that matters is no cross-context *write*,
which Invariant 1 already covers.

## 7. Dependencies

### Allowed

- **Order** — Shipping is called *by* Order (`createShipment`); Shipping
  never calls back into Order directly, only via events the event bus
  delivers to Order's own listener (`ShipmentDelivered`, etc. — see §5).
  This requires Order's own dependency list to include Shipping — jwel
  does not yet have a formal `DOM-ORDER.md` to amend, so this is recorded
  here as the authoritative statement of that dependency until one
  exists; formalizing `DOM-ORDER.md` is flagged in §9 as a real gap this
  feature surfaces, per `OV-006`'s own rule that a missing dependency
  belongs at the architecture/domain layer, not silently assumed.
- **Inventory** — the one domain Shipping actually *calls*: a direct
  `restock()` request on a confirmed RTO (mirrors how Returns already
  calls Inventory on a confirmed return).

Notification and Payment are deliberately **not** listed here even
though `ARCHITECTURE.md`'s event catalog shows them as consumers of
Shipping's events — publishing an event isn't calling a domain; it's the
reverse dependency (Notification and Payment each independently depend
on Shipping's events, the same asymmetry Order has). Neither belongs in
Shipping's own Allowed list; each would list Shipping as a consumed
event source in its own (Notification's, Payment's) domain spec instead.

### Forbidden

- Direct writes to `orders`, `payments`, or `inventory_items` tables —
  every cross-domain effect goes through a service call Shipping
  initiates (Inventory restock) or an event it publishes (everything
  else), never a direct Prisma write into another domain's table.
- Reading or writing `users.passwordHash` or any Identity-owned field —
  Shipping only ever needs a shipping address snapshot (already captured
  on `Order.shippingAddress`), never raw user/account data.

## 8. Edge Cases & Validations

- **Shiprocket serviceability check fails/times out at checkout.**
  Degrade to "COD unavailable, pincode delivery window unconfirmed" and
  let checkout proceed prepaid-only — never block checkout entirely on a
  third-party API being down (same posture Payments already takes toward
  Razorpay being an inactive stub: a provider outage is handled, not
  fatal).
- **Webhook delivered out of order or duplicated.** Shipment status
  transitions must be idempotent and monotonic (e.g. a `PICKED_UP`
  webhook arriving after `DELIVERED` was already recorded is a no-op, not
  a regression) — same idempotency discipline `PaymentsService.markSucceeded`
  already uses for Stripe webhook replay.
- **NDR raised on a COD order vs. a prepaid order.** A COD NDR
  (customer refused/unavailable) has no refund implication; a prepaid NDR
  resolving to RTO requires Order to eventually cancel and Returns/Payment
  to consider a refund path — this is a genuinely different downstream
  flow the admin NDR-decision endpoint must distinguish, not treat
  uniformly.
- **Order cancelled after a shipment was already created but before
  pickup.** Shipping must attempt to cancel the Shiprocket-side
  shipment/AWB, not just stop tracking it locally — an uncancelled AWB on
  a cancelled order is a real operational cost (courier still attempts
  pickup).
- **Declared value insurance threshold at exactly ₹50,000.** Invariant 3
  is written as "above ₹50,000" (strictly greater than) — an order at
  exactly the threshold is uninsured; this boundary choice should be
  revisited once real claims/loss data exists (see §9).

## 9. Open Questions

- **`DOM-ORDER.md` does not yet exist in jwel's own `knowledge/`.** This
  spec's §7 records Order's dependency on Shipping as if it were already
  declared there; formalizing a real `DOM-ORDER.md` (ideally seeded from
  the M8-audit-corrected Order domain content already validated in
  Oriveda's `examples/m5-domains-jwel-walkthrough.md`) should happen
  before or alongside `FEAT-SHIPPING`'s implementation, not indefinitely
  deferred.
- **The 48h NDR SLA window (Invariant 5) and the ₹25,000/₹50,000
  thresholds (Invariants 3, 4) are starting heuristics**, not derived
  from jwel's own operational data (none exists pre-launch) — revisit
  once real order/NDR volume exists.
- **Whether Shipping needs its own admin UI or extends the existing
  Admin Orders page** with a shipment/tracking panel — a UI-layer
  decision for `FEAT-SHIPPING` to make, not this domain spec's concern.
