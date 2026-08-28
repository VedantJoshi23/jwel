---
id: ADR-0024
title: Interim Pincode Deliverability Estimate — Behind the Shipping Port, Ahead of Shiprocket
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-28
updated: 2026-08-28
milestone: M6
category: Decisions
priority: Medium
depends_on:
  - ADR-0001
required_by:
  - FEAT-DELIVERY-ESTIMATE
related_documents:
  - DOM-SHIPPING
  - FEAT-SHIPPING
related_decisions:
  - ADR-0001
tags:
  - decision
  - shipping
  - interim
risk: Medium
complexity: Low
---

# ADR-0024 — Interim Pincode Deliverability Estimate

## Context

`DOM-SHIPPING` has stood as **NOT IMPLEMENTED** since 2026-08-06: no shipping
code exists anywhere in this repo, and the reason recorded there is external,
not a backlog choice — the client's Shiprocket account is suspended, with
restoration pending (KC-101). `FEAT-SHIPPING`'s full scope (serviceability
gated into checkout, COD eligibility, shipment/AWB lifecycle, NDR queue, COD
remittance) stays blocked on that same account.

On 2026-08-28 the client asked for something narrower and storefront-facing:
a pincode box on the home page and the product detail page that tells a
shopper whether an item is deliverable to them and roughly when it would
arrive. This is not `FEAT-SHIPPING`'s checkout-time serviceability gate
(Invariant 2) — it carries no COD-eligibility check (Invariant 4 needs order
value and purchase history, a checkout concern), and it appears on two
surfaces `DOM-SHIPPING` never named.

Three ways to answer that request were weighed with the owner:

1. **Wait for Shiprocket restoration**, build nothing now. Correct
   long-term, but the account block has no committed resolution date, and the
   gap stays live and visible on the storefront for however long that takes.
2. **Build the real thing now, assuming restoration is imminent.** Rejected
   outright — the account is still blocked as of this decision (confirmed by
   the owner choosing option 3 below over "the account is restored, build the
   real integration" when asked directly); there is no live Shiprocket
   credential to integrate against.
3. **Build an interim, non-Shiprocket estimator now**, honestly scoped and
   labeled, behind the `ShippingProviderPort` `ADR-0001` already specified —
   swappable for the real adapter with no surface-level change once the
   account is back.

The owner chose (3). The hard constraint on doing so is Constitution **Law
1**: a widget that tells a shopper "Yes, deliverable, arriving in 3 days" with
nothing behind that claim but an invented happy path is exactly the failure
pattern Law 1 exists to catch — so this ADR exists to record, in the open,
that the estimate is real in the sense that it's rule-based and disclosed as
an estimate, and is *not* a live-carrier check.

## Decision

Build the estimator as a genuinely separate, narrower capability from
`FEAT-SHIPPING`, not a partial implementation of it:

- **A pan-India-deliverable-by-default heuristic**, layered under an
  admin-maintained exceptions table (`PincodeServiceabilityOverride`) for
  pincodes the business already knows are unserviceable, or that warrant a
  different estimate window (metro vs. remote). This is the honest shape of
  what a pre-launch D2C jewellery shop actually knows about its own delivery
  footprint — not an attempt to simulate Shiprocket's pincode database.
- **Two tunable defaults**, `shipping.default_min_days` /
  `shipping.default_max_days`, added to the existing generic Settings store
  (`FEAT-SETTINGS-STORE`) rather than hardcoded — same tuning-without-deploy
  pattern `recommendations.min_co_occurrence` already established.
- **Scope is deliverability + estimated window only.** No COD eligibility, no
  shipment creation, no AWB, no NDR, no COD remittance — all of that stays
  `FEAT-SHIPPING`'s job, still blocked, still unbuilt.
- **Built behind `ShippingProviderPort`**, per `ADR-0001`'s already-accepted
  design (`ShippingService` depends only on the port; no adapter-specific
  shape leaks past it). `StaticZoneShippingProvider` is the only adapter
  today. A future `ShiprocketProvider` implementing the same port is a
  contained swap, not a rewrite — the same payoff the payment port already
  delivered when Stripe was dropped for Razorpay (`ADR-0005`).
- **Reuses `DOM-SHIPPING` §4's already-declared endpoint shape** —
  `GET /api/v1/shipping/serviceability?pincode=...` — rather than inventing a
  new route for the interim version. The spec's `codRequested` query param is
  not accepted by this slice; omitted, not silently accepted and ignored.
- **Structural honesty, not just copy.** The API response carries a
  `source: 'ESTIMATED'` discriminator that the UI renders as visible
  "Estimated" language. This is a field a future `ShiprocketProvider` would
  set to `'CARRIER_VERIFIED'`, not a copywriting choice that could drift from
  the data source silently.
- **`DOM-SHIPPING`'s NOT IMPLEMENTED banner is corrected**, not left standing
  as written — it no longer describes the current state of the repo once this
  ships, and Law 1 applies to internal specs the same as storefront copy.

Full detail — acceptance criteria, API/data shape, edge cases — lives in
`FEAT-DELIVERY-ESTIMATE`, owned by `DOM-SHIPPING` per the same
exactly-one-owning-domain rule `FEAT-SHIPPING` itself follows.

## Consequences

1. **Two Shipping-adjacent Feature Specs now exist with different scopes and
   different statuses** — `FEAT-SHIPPING` (Proposal, blocked, the real
   integration) and `FEAT-DELIVERY-ESTIMATE` (this ADR, built now). A future
   contributor must not read the interim estimator as `FEAT-SHIPPING` already
   landed; the two documents cross-reference each other precisely to prevent
   that.
2. **The pan-India-default assumption is a real, if small, risk of a wrong
   promise.** A pincode nobody has flagged as an exception gets "deliverable,
   4–7 days" even though nobody has verified it. This is the same category of
   risk `DOM-SHIPPING`'s own Edge Case already accepts for a Shiprocket
   *outage* ("degrade to prepaid-only, don't block checkout") — here it is
   the default posture rather than a fallback, because there is no live
   check to fall back *from*. Mitigated by disclosure (`source: 'ESTIMATED'`
   in copy) and by giving admins a fast path to add an exception the moment a
   bad delivery surfaces one.
3. **The exceptions table is empty at launch** — there is no seed data
   describing which pincodes are actually unserviceable, because that
   knowledge does not exist yet pre-launch (mirrors `DOM-SHIPPING` §9's own
   framing: the 48h NDR window and ₹25k/₹50k thresholds are starting
   heuristics, not derived data). The admin UI is the mechanism by which that
   knowledge accumulates operationally, not a one-time setup step.
4. **When Shiprocket is restored**, swapping the provider is contained to a
   new adapter class plus the `ShippingModule`'s provider wiring (mirrors
   `payments.module.ts`'s factory-selected adapter) — no controller, DTO, or
   frontend change is required by this ADR's design. What *does* change at
   that point: `FEAT-SHIPPING`'s full scope (COD eligibility, shipment
   lifecycle) still needs building; the estimator does not become that
   feature by having its provider swapped.

## Alternatives Considered

- **A third-party pincode-lookup API** (e.g. an India-Post pincode/PIN
  directory) for real geographic data without carrier serviceability.
  Rejected for this interim pass: it answers "does this pincode exist and
  where," not "can we actually deliver here and how fast" — no more honest
  than the admin-managed heuristic on the question that matters, while adding
  a new external vendor dependency to a stopgap explicitly meant to be cheap
  and temporary.
- **Fabricated/static happy-path data** (every pincode "deliverable, 3–5
  days," no exceptions mechanism at all). Rejected outright — indistinguishable
  from the Law 1 violation this ADR exists to avoid.
- **Wait for Shiprocket, ship nothing.** Rejected by the owner as the current
  path, per Context — an indefinite external blocker with no committed date
  is not a reason to leave a requested, low-risk storefront capability
  unbuilt when an honest interim version is available.

## Revisit Criteria

- **Named trigger:** the Shiprocket account is restored. At that point, build
  `ShiprocketProvider` behind the existing `ShippingProviderPort`, wire it in
  place of `StaticZoneShippingProvider`, and open `FEAT-SHIPPING`'s full scope
  (checkout gating, COD eligibility, shipment lifecycle) as the next piece of
  work — not before, since there is nothing to integrate against until then.
- Real order/delivery-failure data accumulates against the pan-India-default
  assumption in Consequence 2, in enough volume to say whether the default
  posture (deliverable unless flagged) or its opposite (unconfirmed unless
  flagged) is the safer starting point.

## Cross References

- `ADR-0001` — the port design this ADR builds the first adapter for.
- `DOM-SHIPPING` — status banner corrected to reflect this interim
  capability; the rest of the domain (shipments, tracking, NDR, COD
  remittance) remains as documented, still unbuilt.
- `FEAT-SHIPPING` — unchanged in scope; this ADR does not implement any part
  of it, despite sharing the same owning domain and port.
- `FEAT-DELIVERY-ESTIMATE` — the Feature Specification this ADR authorizes.
