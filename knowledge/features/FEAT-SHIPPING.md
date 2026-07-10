---
id: FEAT-SHIPPING
title: Jwel — Feature: Shiprocket Order Fulfillment & Tracking
version: 0.1.0
status: Proposal
owner: Architecture
reviewers: []
created: 2026-07-09
updated: 2026-07-09
milestone: M6
category: Features
priority: High
depends_on:
  - DOM-SHIPPING
  - ADR-0001
required_by: []
related_documents: []
related_domains:
  - DOM-SHIPPING
related_features: []
related_decisions:
  - ADR-0001
tags:
  - feature
  - shipping
risk: High
complexity: High
---

## Feature: Shiprocket Order Fulfillment & Tracking

### 1. Overview

Closes the FR-9/FR-10 gap named since Milestone 2: real courier
integration for checkout-time serviceability/COD eligibility, shipment
creation and AWB tracking once an order is ready to fulfill, and
customer-facing order tracking — all via Shiprocket, per `ADR-0001`.
Covers the admin side too: an NDR (non-delivery) decision queue and COD
remittance visibility, both currently nonexistent.

### 2. Owning Domain

**Owning domain:** `DOM-SHIPPING` — shipment creation, carrier tracking
state, serviceability checks, and COD remittance are what this feature is
actually about; Order's role is the entry point (it initiates
`createShipment` once ready to fulfill), not the owner of the outcome —
same reasoning the Checkout feature's own owning-domain call used for
Order vs. Cart (see Oriveda's `examples/m6-features-jwel-walkthrough.md`
— jwel has no formal `FEAT-CHECKOUT.md` of its own yet either, same gap
pattern as `DOM-ORDER.md`).

**Other domains involved** (dependencies only, each cross-domain call
checked against whichever domain initiates it, not attributed wholesale
to Shipping):

- **Order** (initiates `Shipping.createShipment(...)` when transitioning
  to `PROCESSING`; consumes `ShipmentDelivered`/`ShipmentRtoInitiated`/etc.
  via the event bus, never a direct call back from Shipping — per
  `DOM-SHIPPING` §7, this dependency is recorded there pending a formal
  `DOM-ORDER.md`).
- **Inventory** (Shipping calls `restock()` on a confirmed RTO — mirrors
  the existing Returns→Inventory call — the only domain Shipping
  actually calls besides being called by Order).

Notification and Payment are not dependencies of this feature in the
"calls" sense — both independently consume Shipping's published events
(`ShipmentCreated`/etc. for Notification, `CodRemittanceReceived` for
Payment/Analytics), which is a reverse dependency belonging to their own
domain specs, not something this feature or `DOM-SHIPPING` needs to list
as an outbound call (see `DOM-SHIPPING` §7's note on this same point).

### 3. Acceptance Criteria

- [ ] At checkout, entering a delivery pincode shows serviceability
      (deliverable Y/N, estimated delivery window) and whether COD is
      offered for that pincode, before payment method selection.
- [ ] COD is not offered at all for an order total above ₹25,000, or for
      a customer with no prior `DELIVERED` order (`DOM-SHIPPING`
      Invariant 4).
- [ ] If the Shiprocket serviceability call fails or times out, checkout
      still proceeds (prepaid-only, with delivery estimate shown as
      "confirmed after order placement") rather than blocking (Invariant
      2 / Edge Case 1).
- [ ] When an order transitions to `PROCESSING`, a shipment is created
      with Shiprocket and an AWB/tracking number is persisted; the order
      automatically transitions to `SHIPPED` only once `ShipmentCreated`
      is confirmed, not optimistically before.
- [ ] Every shipment above ₹50,000 declared value is created with
      insurance selected (Invariant 3); this is not a customer-facing
      toggle — it's automatic based on order value.
- [ ] Shiprocket webhook deliveries update shipment status idempotently;
      a duplicated or out-of-order webhook does not regress a shipment's
      recorded status (Edge Case 2).
- [ ] A customer can view an order's live shipment status and AWB
      tracking link from their order detail page.
- [ ] An NDR (non-delivery) shows up in an admin queue; admin can record
      a reattempt or confirm RTO. An NDR unresolved past 48h is flagged
      overdue in that queue, not silently dropped (Invariant 5).
- [ ] A confirmed RTO triggers an Inventory restock and — for a prepaid
      order — surfaces on the order for a refund decision (distinct from
      a COD RTO, which has no refund implication; Edge Case 3).
- [ ] Cancelling an order after shipment creation but before pickup
      attempts to cancel the Shiprocket-side AWB, not just local tracking
      (Edge Case 4).

### 4. API Surface

Restated from `DOM-SHIPPING` §4, not reinvented here:

`GET /api/v1/shipping/serviceability`, `GET /api/v1/orders/:id/tracking`,
`POST /api/v1/shipping/webhooks/shiprocket`, `GET /api/v1/admin/shipments`,
`GET /api/v1/admin/shipments/:id`, `POST /api/v1/admin/shipments/:id/ndr-decision`.

### 5. Events

#### Publishes (via Shipping)

`ShipmentCreated`, `ShipmentPickedUp`, `ShipmentInTransit`,
`ShipmentOutForDelivery`, `ShipmentDelivered`, `ShipmentNdrRaised`,
`ShipmentRtoInitiated`, `CodRemittanceReceived`.

#### Consumes

None directly by this feature — Order's own consumption of the events
above (to apply its status transitions) is inherited from `DOM-SHIPPING`
§7, not redeclared here.

*(This is an exact subset of `DOM-SHIPPING` §5 — no new event invented at
this layer.)*

### 6. Data Changes

Restated from `DOM-SHIPPING` §6: new tables `shipments`,
`shipment_status_history`, `cod_remittances`. No existing table's
ownership changes; `shipments.orderId` is a read-reference FK to `orders`
only (no write), per the M8 audit's correction to `STD-DATABASE`.

### 7. Edge Cases & Validations

Restated and made feature-concrete from `DOM-SHIPPING` §8:

1. Serviceability check failure/timeout at checkout → degrade to
   prepaid-only, don't block checkout.
2. Duplicate/out-of-order webhook → idempotent, monotonic status update
   only.
3. NDR on COD vs. prepaid order → different downstream flow (no refund
   path vs. a refund decision on RTO).
4. Order cancelled post-shipment-creation, pre-pickup → attempt
   Shiprocket-side AWB cancellation, don't just stop local tracking.
5. Declared-value insurance boundary is exactly at ₹50,000 (exclusive) —
   worth a dedicated test case, not just documentation.

### 8. Non-Functional Considerations

Checked against the Standards already validated for jwel in Oriveda's
sandbox run (`examples/m4-standards-jwel-walkthrough.md`, corrected by
the M8 audit) — jwel does not yet have these formalized in its own
`knowledge/standards/`, flagged here rather than silently assumed settled:

| Standard | Relevant? | Notes |
| --- | --- | --- |
| STD-API | Yes | New endpoints follow the same versioned-prefix, envelope-error convention as every other `api/v1` route; webhook route follows the Stripe webhook's `@Public()` + raw-body + signature-verification pattern exactly. |
| STD-DATABASE (corrected) | Yes | `shipments.orderId` is a cross-context read FK — fine under the corrected rule; no cross-context *write* anywhere in this feature (Invariant 1). |
| STD-TESTING | Yes | Webhook idempotency and the NDR COD/prepaid branching (Edge Cases 2–3) are exactly the kind of case that needs a real test, not just a happy-path one — this codebase's existing 90%+ coverage gate applies unchanged. |
| Security (SECURITY.md §4-equivalent) | Yes | Shiprocket webhook must be signature-verified before trusting its payload, same posture as the Stripe webhook — never trust an unverified `POST` claiming a shipment was delivered. |
| Accessibility | Partial | The serviceability/pincode input and tracking status timeline are the only UI surfaces this feature adds — both need the same keyboard/screen-reader treatment as existing form inputs and the order status timeline already on the order detail page; no new accessibility pattern is introduced. |
| Observability | Not applicable — not yet implemented at all for jwel (a pre-existing gap named in the M8 audit, not something this feature should silently take on). Webhook failures should at minimum log loudly (matching `EventBusService`'s existing "log, don't swallow" handler-failure pattern) until real observability infra exists. |

### 9. Definition of Done

- [ ] `ShippingProviderPort` + `ShiprocketProvider` adapter implemented,
      unit-tested against a mocked Shiprocket client (mirrors
      `payment-provider.port.ts`'s test pattern).
- [ ] Prisma migration for `shipments`, `shipment_status_history`,
      `cod_remittances`.
- [ ] Serviceability check wired into the checkout flow, with the
      documented degrade-on-failure behavior tested explicitly.
- [ ] Webhook endpoint signature-verified, idempotent, covered by a
      duplicate-delivery test case.
- [ ] Admin NDR queue + decision endpoint; overdue-NDR flagging tested
      with a time-travel/fake-clock test, not just a happy-path one.
- [ ] Customer-facing tracking view added to the order detail page.
- [ ] `DOM-ORDER.md` gap (§9 of `DOM-SHIPPING`) either formalized
      alongside this feature or explicitly deferred with the reason
      recorded, not silently ignored.
- [ ] `README.md`'s stack/status table and `BACKEND.md` updated to
      reflect Shipping as implemented, the same way Search/Recommendation
      were documented once built.
