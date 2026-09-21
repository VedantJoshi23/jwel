---
id: ADR-0029
title: Shiprocket Integration As Built — Prepaid-Only, Admin-Triggered, Token-Authenticated Webhook
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-09-21
updated: 2026-09-21
milestone: M6
category: Decisions
priority: High
depends_on:
  - ADR-0001
  - ADR-0024
required_by:
  - FEAT-SHIPPING
related_documents:
  - DOM-SHIPPING
  - FEAT-SHIPPING
related_decisions:
  - ADR-0001
  - ADR-0005
  - ADR-0024
tags:
  - decision
  - shipping
  - integration
risk: Medium
complexity: Medium
---

# ADR-0029 — Shiprocket Integration As Built

## Context

`DOM-SHIPPING` and `FEAT-SHIPPING` were written on 2026-07-09, while the
client's Shiprocket account was suspended (KC-101) and before several facts
about the business and the vendor were known. The account is restored
(2026-08-28), KYC is complete, and an API user exists (2026-09-21). Building
against the specs as written would mean implementing capabilities the business
has ruled out and a webhook contract the vendor does not offer.

Four things changed in the world since those specs were written:

1. **COD is permanently off.** The client decided against Cash on Delivery
   (KC-109, confidence 100); Razorpay is the sole provider (`ADR-0005`).
2. **The catalogue is not high-value.** Every variant is priced ₹1,850–₹5,500
   (checked against the live catalogue, 2026-09-21). `DOM-SHIPPING`
   Invariant 3's ₹50,000 insurance threshold assumed a fine-jewellery AOV that
   does not exist.
3. **Shiprocket's webhook is not signed.** Its dashboard sends a fixed,
   seller-chosen token in a header the seller picks (`x-api-key` or
   `Authorization`) — there is no HMAC over the body, so the "signature-verified,
   same pattern as payments" requirement cannot be met literally.
4. **Shiprocket rejects webhook URLs containing** `shiprocket`, `kartrocket`,
   `sr` or `kr` (stated on its own Webhooks settings page). `DOM-SHIPPING` §4's
   `/api/v1/shipping/webhooks/shiprocket` cannot be registered.

The owner also made two operational decisions on 2026-09-21 that the specs left
open.

## Decision

1. **Prepaid only.** `DOM-SHIPPING` Invariant 4 (COD eligibility), the
   `cod_remittances` table, the `CodRemittanceReceived` event and the COD
   branch of the NDR edge case are **withdrawn**, not deferred. Every
   serviceability call sends `cod=0`. Invariant 2 narrows to deliverability.
2. **Insurance is not built now.** Invariant 3 stands as written — it is a
   correct rule — but with no product priced within a tenth of its threshold it
   cannot trigger, so no code path is built for it. It is re-armed by the
   Revisit Criteria below, not by memory.
3. **Webhook authentication is a constant-time comparison** of the
   `x-api-key` header against `SHIPROCKET_WEBHOOK_SECRET`
   (`crypto.timingSafeEqual`), not a body signature. The route is
   `POST /api/v1/shipping/webhooks/carrier`, on the API origin
   (`api.elysianjewellers.com`) — never the storefront apex, which does not
   proxy `/api` in production.
4. **An unrecognised AWB is acknowledged with 200 and logged**, not rejected.
   Shiprocket's "Test Webhook" posts a sample AWB and refuses to save the
   webhook without a 2xx; a 4xx would also invite pointless redelivery of
   events for shipments this system never created.
5. **Shipments are created by an admin action**, not automatically on
   `PROCESSING`. The admin packs the order, then triggers creation; wallet
   money is spent only on orders that physically exist.
6. **Courier selection is delegated to Shiprocket's recommendation** — the AWB
   is assigned without a `courier_id`. No courier-ranking logic lives here.
7. **Order-to-Shipping stays a direct call; Shipping-to-Order stays events.**
   Both create and cancel are Order calling Shipping (already Allowed in
   `DOM-SHIPPING` §7). Shipping reports back only through events that Order's
   own listener applies (Invariant 1). No new cross-domain dependency is
   introduced.
8. **Missed webhooks are recovered by polling.** A scheduled reconciliation
   polls tracking for every non-terminal shipment, so an undelivered webhook
   delays a status change rather than losing it (Constitution Law 6).
9. **`DOM-ORDER.md` stays deferred.** `DOM-SHIPPING` §7 remains the
   authoritative record of the Order↔Shipping dependency. Authoring the full
   Order domain is not required to build this feature, and would block it on
   unrelated work.

## Consequences

- Build scope shrinks: no COD ledger, no COD eligibility rules, no insurance
  path, no courier-selection logic.
- The webhook's protection is only as strong as the token's secrecy — there is
  no replay protection from the vendor. This is acceptable because every
  status change is monotonic (`DOM-SHIPPING` Edge Case 2): replaying a real
  event cannot regress a shipment, and forging one requires the token.
- A webhook that never arrives no longer means a shipment is stuck forever;
  it means it is late by at most one reconciliation interval.
- Freight is absorbed by the business on every order (shipping is free to the
  customer), so the Shiprocket wallet is a real operating cost that must be
  kept funded — an empty wallet makes AWB assignment fail, and the admin
  action must surface that failure clearly rather than as a generic error.

## Remediation

What existing work this changes, and how:

- **`DOM-SHIPPING`** — revised in place to v0.2.0: withdrawn items marked
  withdrawn (retained, not deleted), §4 route and auth corrected.
- **`FEAT-SHIPPING`** — revised to v0.2.0: COD acceptance criteria withdrawn,
  trigger and webhook contract made concrete.
- **`OrdersService.adminUpdateStatus`** — `PROCESSING → SHIPPED` stops being
  the normal path; it becomes a recorded manual override (note required) for
  when Shiprocket is unavailable. The normal path is the `shipment.created`
  event.
- **Admin Orders page** — its hardcoded transitions table loses the plain
  "Shipped" button in favour of "Create shipment".
- **Checkout** — gains a deliverability check at the address step; a
  carrier-verified "not deliverable" blocks, a failed lookup does not
  (Edge Case 1).

## Alternatives Considered

- **Keep the COD design, just leave it switched off.** Rejected: KC-109 is a
  settled business decision, not a pending one. Dormant COD code would need
  maintaining and testing for a capability that is not coming — the same
  reasoning that removed the COD storefront claim rather than correcting it.
- **Automatic shipment creation on `PROCESSING`.** Rejected by the owner:
  spends wallet money before a parcel is packed, and turns every late
  cancellation into a Shiprocket-side cancellation.
- **Reject unknown AWBs with 404.** Rejected: blocks webhook registration
  outright (decision 4).
- **Our own courier ranking (cheapest/fastest).** Rejected by the owner for
  now: Shiprocket's recommendation already weighs cost, speed and pickup
  performance, and at ~50 orders/month the savings would not pay for the logic.

## Revisit Criteria

- Any product priced at or above ₹25,000 is published → re-arm Invariant 3
  (insurance) before that product can ship.
- The client reverses KC-109 → COD returns as a new ADR, not by un-withdrawing
  the old invariant.
- Shiprocket begins signing webhook bodies → move to signature verification.
- Monthly volume makes freight a material cost → reconsider decision 6.

## Cross References

- `ADR-0001` — Shiprocket as provider, behind `ShippingProviderPort`
- `ADR-0024` — the static estimator, which remains the degrade target
- `ADR-0005` — Razorpay as sole payment provider
- KC-109 (COD ruled out), KC-101 (account suspension, now resolved)
