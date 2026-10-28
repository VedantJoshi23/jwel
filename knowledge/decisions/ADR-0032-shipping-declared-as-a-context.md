---
id: ADR-0032
title: Shipping Declared as a Bounded Context; Ordering's Dependency on It Made Explicit
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-10-28
updated: 2026-10-28
milestone: M8
category: Decisions
priority: High
depends_on:
  - ARCH-001
  - DOM-ORDERING
  - DOM-SHIPPING
  - ADR-0029
required_by:
  - FEAT-SHIPPING
related_documents:
  - DISC-006
related_decisions:
  - ADR-0021
  - ADR-0029
  - ADR-0031
related_domains: []
related_features: []
tags:
  - decision
  - architecture
  - shipping
  - ordering
risk: High
complexity: Medium
---

# ADR-0032 — Shipping Declared as a Context; Ordering → Shipping Made Explicit

## Context

Shipping Phases 0–1 are live on `main`: the `shipments`,
`shipment_status_history` and `pincode_serviceability_overrides` tables, the
Shiprocket webhook, and six `shipment.*` events. Three Frozen documents have not
caught up:

1. **`ARCH-001` §1.1 declares no Shipping context**, and §3 lists no
   `shipment.*` event. `DISC-006` predicted this (*"Shipping has no context yet,
   and when it arrives it will very likely be the first module to import
   Orders"*). Product Q&A needed Amendment A4 for the same step; Shipping never
   got one. A module owning tables and publishing events under no declared
   boundary disagrees with a Frozen spec today, not in Phase 2.
2. **`DOM-ORDERING` §7 does not allow Shipping.** `DOM-SHIPPING` §7 and
   `ADR-0029` decisions 7 and 9 say Ordering calls `createShipment` /
   `cancelShipment`, and that `DOM-SHIPPING` §7 is "the authoritative record"
   of that dependency *because `DOM-ORDER.md` does not exist*.
3. **That premise is false.** `DOM-ORDERING` has existed, Frozen, since
   2026-08-07. The `DOM-SHIPPING` text dates from July, and `ADR-0029` carried it
   forward. A Proposal spec cannot be authoritative over a Frozen one
   (Oriveda `ADR-0005` rule 1), so `ADR-0029` decision 7's *"no new
   cross-domain dependency is introduced"* is wrong.

## Decision

1. **Shipping is a sixteenth context** in `ARCH-001` §1.1. It owns Shipment,
   ShipmentStatusHistory, PincodeServiceabilityOverride, the provider
   integration and serviceability. It does NOT own order status (it emits;
   Ordering moves itself) or freight pricing to the customer.
2. **Ordering → Shipping, by command, for `cancelShipment`.** An order cancelled
   after AWB assignment must cancel the AWB, or a courier attempts a parcel
   that will not ship — money-relevant, so per `ARCH-001` §3.1 it is a
   synchronous command, not an event.
3. **Shipment creation is an admin command to Shipping, not to Ordering.**
   `ADR-0029` decision 5 makes creation an admin action. Shipping serves it:
   its controller reads the order, creates the shipment and emits
   `shipment.created`, which Ordering applies. Creation therefore stays out of
   Ordering's dependency list. The URL `DOM-SHIPPING` §4 names
   (`POST /api/v1/admin/orders/:id/shipment`) is a route, not an owner; it may
   stay as written, served by Shipping's controller.
4. **Shipping reads Ordering** (order id, shipping-address snapshot, totals for
   the manifest) — a read, the pattern Reviews and Product Q&A already use.
5. **`ADR-0029` decision 9 is superseded.** `DOM-ORDERING` §7 is the
   authoritative record of Ordering's dependencies, as it always was.

## Required Updates (applied 2026-10-28)

- **`ARCH-001` → v1.5.0, Amendment A5** (shared with `ADR-0030`, `ADR-0031`).
  §1.1 gains the Shipping row (decision 1). §3 gains the six live
  `shipment.*` events as `Shipping | Ordering` once Ordering's listener exists,
  and `shipment.created` with Phase 2. §1.1's count becomes sixteen.
- **`DOM-ORDERING` → v1.3.0.** §7 Allowed gains *"Shipping (command —
  `cancelShipment`, `ADR-0032`)"*; Forbidden gains *"writing `shipments`"*. §5
  Consumes gains `shipment.created` and the carrier-driven `shipment.*`
  events, from Shipping, when Phase 2 lands. **Must be Frozen before the
  Phase 2 commit that wires it.**
- **`DOM-SHIPPING` → v0.3.0, Draft** — §5 event names corrected (`DIV-003`),
  §5 Consumes and §7 point at `DOM-ORDERING` §7, "Ordering (read)" added, the
  §9 `DOM-ORDER.md` question withdrawn, the built-so-far banner brought up to
  date. Not Frozen: see Remediation.
- **`ADR-0029`** — a dated note under decision 9: "Superseded by `ADR-0032`;
  `DOM-ORDERING` exists and is Frozen."

## Remediation

- Nothing in code changes today: Ordering does not import Shipping yet, and
  Shipping writes only its own tables (now enforced by
  `common/architecture.spec.ts`, `ADR-0031`).
- `DOM-ORDERING` v1.3.0 is Frozen and decision 3 is made, so Phase 2's
  boundary questions are settled.
- **`DOM-SHIPPING` is not Frozen by this ADR.** Oriveda `ADR-0005` rule 2 binds
  (`risk: High`), and it binds from adoption forward: `DOM-SHIPPING` is Frozen
  before any Phase 2 code starts and before any production release that ships
  Shipping behaviour. Freezing it today would freeze guesses — pickup
  location, package dimensions and wallet funding are still owed by the
  client, and they shape Phase 2's invariants.

## Alternatives Considered

- **Leave `DOM-SHIPPING` §7 authoritative, as `ADR-0029` chose.** Rejected: it
  was premised on a missing spec that is not missing, and it lets a Proposal
  overrule a Frozen spec.
- **Ordering emits `order.cancelled`; Shipping cancels the AWB on it.** Keeps
  Ordering free of Shipping entirely. Rejected for now: a lost event on the
  at-most-once bus leaves a live AWB on a cancelled order. Revisit when the bus
  is durable (`ADR-0010`), or if the reconciliation poll (`ADR-0029` decision 8)
  is extended to cancel AWBs for cancelled orders, which would make the
  event re-derivable.
