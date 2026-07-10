---
id: ADR-0001
title: Shiprocket as the Shipping Provider, Behind a Swappable Port
version: 1.0.0
status: Proposal
owner: Architecture
reviewers: []
created: 2026-07-09
updated: 2026-07-09
milestone: M3
category: Decision
priority: High
depends_on: []
required_by:
  - DOM-SHIPPING
tags:
  - shipping
  - logistics
  - decision
risk: Medium
complexity: Medium
---

# ADR-0001 — Shiprocket as the Shipping Provider, Behind a Swappable Port

## Context

`ARCHITECTURE.md`'s Service Boundaries table always excluded "shipping
carrier integration" from Order's ownership, but no bounded context was
ever declared to own it — FR-9 (Checkout) and FR-10 (Order Tracking,
"shipment tracking reference") both name a real requirement with no
implementation behind it. India-focused D2C jewellery shipping needs
multi-courier rate shopping, COD support, NDR (non-delivery) handling,
and — because AOV is high — per-shipment declared-value insurance, not
just a single carrier's API.

## Options Considered

- **Shiprocket** (aggregator). One API surface in front of ~20 Indian
  couriers, built-in rate shopping, COD remittance tracking, NDR/RTO
  workflow, and per-shipment insurance selection. Aggregator margin on
  top of each courier's own rate; a dependency on Shiprocket's own uptime
  and API stability, not just the underlying couriers'.
- **Direct integration with a single carrier** (e.g. Delhivery). Lower
  per-shipment cost (no aggregator margin), simpler integration surface.
  Rejected as the primary path — no rate shopping across couriers, and
  every serviceability gap in that one carrier's pincode coverage becomes
  jwel's own gap with no fallback.
- **Build a custom rate-shopping layer across several direct carrier
  integrations.** Rejected — this is a real business (it's what Shiprocket
  and its competitors already sell), not a reasonable scope for jwel to
  own; it would take real integration effort with each courier
  individually for a worse result than an existing aggregator.

## Decision

Shiprocket is the shipping provider, integrated behind a
`ShippingProviderPort` (mirrors `PaymentProviderPort`'s Stripe/Razorpay
split — see `BACKEND.md` §... and `SECURITY.md` §4). No Shiprocket-specific
type or API shape may leak outside the `infrastructure/shiprocket/`
adapter; `ShippingService` only ever depends on the port.

Unlike Payment's live/stub split (Stripe active, Razorpay stubbed but
present), only one Shipping adapter exists at launch — a second
aggregator or direct-carrier adapter is future work if Shiprocket's
serviceability or pricing proves insufficient, not built speculatively now.

## Consequences

- Aggregator margin is a real, ongoing cost on top of each shipment's
  base courier rate — accepted in exchange for not building/maintaining
  multi-courier integration ourselves.
- Shiprocket's own API uptime becomes a dependency for checkout-time
  serviceability checks; per `DOM-SHIPPING`'s Edge Cases, a serviceability
  check failure must degrade to "COD/pincode unconfirmed, proceed with
  prepaid only" rather than block checkout entirely.
- Declared-value insurance is selected per shipment based on order value
  (see `DOM-SHIPPING` Invariant 3) — this is a real, itemized cost for
  high-AOV jewellery orders, not optional given the fraud/loss exposure a
  0.5–2× monthly-salary item represents in transit.
- Swapping providers later means re-implementing one adapter class, not
  touching `OrdersService`, `ReturnsService`, or any controller — same
  payoff the Payment port already delivers.

## Revisit Criteria

Revisit if: Shiprocket's serviceability coverage or COD remittance
turnaround proves materially worse than a competitor for jwel's actual
shipping lanes once real volume exists; or if a second market (outside
India) needs a shipping provider Shiprocket doesn't serve at all — not
before real operational data exists, per the same reasoning `ADR-0003`
(Oriveda's own submodule-vs-package decision) uses: don't design for a
second provider against zero usage data.
