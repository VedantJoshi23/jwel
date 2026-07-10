---
id: DOM-RISK
title: Jwel — Domain: Risk
version: 0.1.0
status: Proposal
owner: Architecture
reviewers: []
created: 2026-07-09
updated: 2026-07-09
milestone: M5
category: Domains
priority: Medium
depends_on:
  - ADR-0004
required_by:
  - FEAT-FRAUD-RISK-SCORING
related_documents: []
related_domains:
  - DOM-SHIPPING
related_features: []
related_decisions:
  - ADR-0004
tags:
  - domain
  - risk
  - fraud
risk: Medium
complexity: Medium
---

# Domain: Risk

**Tier:** Full — owns real data (scores, velocity counters, the review
queue) and real invariants (scoring inputs, advisory-only enforcement
posture).

## 1. Overview

Computes a fraud/risk score for a newly placed order from velocity
(orders per account per time window), order value relative to account
age/history, and a small set of named heuristics, and flags high-scoring
orders into an admin review queue. Deliberately advisory-only — Risk
never blocks, cancels, or holds an order itself; a human (or a future,
separately-designed automated policy) decides what to do with a flag.

## 2. Ownership

### Owns

- Per-order risk score and the specific signals that produced it (not
  just a number — an admin reviewing a flagged order needs to see *why*
  it scored high).
- Velocity counters (orders per account per rolling time window).
- The flagged-order review queue and its resolution state (cleared,
  confirmed-fraud, order held).

### Explicitly Does NOT Own

*(restated from `ARCHITECTURE.md` §3's Service Boundaries table)*

- Whether to actually block/hold/cancel an order — Order alone applies
  any resulting hold; Risk only ever recommends via a score and an event.
- Payment method eligibility (COD gating) — that remains
  `DOM-SHIPPING`'s independent, static rule; see §9 for why these two
  aren't merged.
- Account/session data itself (login history, device info would live
  with Identity if ever added) — Risk reads what it needs from Order and
  User at scoring time, it doesn't own identity data.

## 3. Invariants

### Invariant 1

> Risk never applies a hold, cancellation, or block to an order directly
> — it only ever publishes a score and, above a threshold, a review-queue
> flag. Any resulting action is Order's own decision (today: a human
> admin's decision, surfaced through Order).

**Source:** New decision, this domain spec (`ADR-0004`'s own "advisory
only" consequence) — chosen specifically to avoid a false-positive
auto-block on a legitimate customer being this domain's first-ever
production incident.

### Invariant 2

> A risk score is computed once, synchronously with order placement (on
> `OrderPlaced`), not retroactively — an order already shipped is not
> re-scored after the fact by this domain (a separate, not-yet-designed
> post-hoc fraud-analysis capability would be a different concern, not
> this one).

**Source:** New decision, this domain spec. Rationale: scoring after
fulfillment has already begun has no actionable outcome for *this*
order — Invariant 1 already establishes the finding is advisory, and
advisory-after-the-fact for an order that's already shipped is not
useful to anyone.

### Invariant 3

> Every score's contributing signals are stored alongside the score
> itself — a bare number with no explanation is not acceptable, because
> an admin resolving a flagged order needs to know *why* it was flagged
> to make a real decision, not guess.

**Source:** New decision, this domain spec, directly informed by
`ADR-0004`'s rejection of "no risk scoring at all" — an opaque score
would recreate the same "nobody can act on this" failure mode that
rejected option was chosen against.

## 4. API Surface

- `GET /api/v1/admin/risk/queue` — flagged-order review queue.
- `POST /api/v1/admin/risk/:orderId/resolve` — admin records a
  resolution (cleared / confirmed-fraud / order held), which in turn
  calls back into Order for any resulting status change (Order applies
  it, per Invariant 1 — Risk's endpoint records the *decision*, it
  doesn't itself mutate `orders.status`).
- No public/customer-facing endpoint — a customer is never shown their
  own risk score or told why an order was flagged (showing a fraud score
  to the person it's scoring defeats its purpose).

## 5. Events

### Publishes

`OrderRiskScored`, `OrderFlaggedForReview` — per `ARCHITECTURE.md` §5.4's
Domain Events Catalog.

### Consumes

`OrderPlaced` — the only trigger for scoring (Invariant 2). No other
inbound event; Risk doesn't react to payment, shipment, or return events
at this stage (whether it should incorporate those later — e.g. a return
pattern as its own risk signal — is an Open Question, not decided now).

## 6. Data Ownership

New tables:

- `order_risk_scores` — `id`, `orderId` (unique FK to `orders`), `score`,
  `signals` (JSON — the named heuristics that fired and their individual
  contribution), `computedAt`.
- `risk_review_queue` — `id`, `orderId`, `status` (enum: `PENDING`,
  `CLEARED`, `CONFIRMED_FRAUD`, `ORDER_HELD`), `resolvedBy`
  (admin user id), `resolvedAt`, `note`.
- `account_velocity_counters` — `id`, `userId` (unique FK to `users`),
  `orderCountRollingWindow`, `windowStartedAt` — a maintained counter,
  not recomputed from a full order-history scan on every score (a
  performance concern once order volume is real, not premature
  optimization for a counter this cheap to maintain incrementally).

All FKs to `orders`/`users` are read-reference only, no cross-context
write — same boundary discipline as `DOM-SHIPPING`/`DOM-NOTIFICATION`.

## 7. Dependencies

### Allowed

- **Order** — Risk is triggered by Order's `OrderPlaced` event (inbound
  only, Risk doesn't call Order to get this); any resulting hold is
  Order's own action taken in response to `OrderFlaggedForReview`, not a
  call Risk makes into Order. Same "jwel does not yet have a formal
  `DOM-ORDER.md`" caveat `DOM-SHIPPING` §7 already notes applies here
  too — recorded here pending that gap being closed.

### Forbidden

- Calling Order, Payment, Shipping, or Inventory to directly change any
  state — Risk's only output is data (score, flag) and events; it never
  mutates another domain's aggregate under any circumstance, not even a
  "confirmed fraud" resolution (that still routes back through Order to
  actually cancel/hold, per Invariant 1).
- Reading raw payment instrument data (card number, CVV — none of which
  jwel stores anyway per `SECURITY.md` §4's PCI-delegation) — Risk's
  signals are order-value/velocity/account-age based, never
  payment-instrument based, since jwel never has that data to read in
  the first place.

## 8. Edge Cases & Validations

- **A first-time customer places a high-value order.** This is exactly
  the pattern Invariant 3's account-age signal is meant to catch — but
  it's also a completely legitimate common case (first purchase from a
  new customer who found the site via paid ads, per `PRODUCT.md`'s own
  acquisition strategy) — the score should contribute to review-queue
  placement, not be treated as fraud-confirmed on its own. This is why
  Invariant 1's advisory-only posture matters most for exactly this case.
- **Velocity counter reset boundary.** An account placing its 5th order
  right at the rolling-window boundary shouldn't get a materially
  different score than one placed a minute earlier/later purely due to
  window-edge timing — the counter implementation needs a rolling
  window, not a fixed calendar-period bucket that resets abruptly.
- **An order already flagged, then the account places another order
  before the first is resolved.** The queue should show both, not
  overwrite or merge them — each order gets its own score and queue
  entry, even from the same account in the same session.
- **Resolution recorded twice for the same order** (e.g. two admins
  acting concurrently) — the resolve endpoint should be idempotent per
  order, not allow contradictory resolutions to both "succeed."

## 9. Open Questions

- **Whether `DOM-SHIPPING`'s static COD-value gate should eventually be
  superseded by a Risk-computed score** instead of two independent,
  parallel fraud controls. Deliberately not merged now — Risk is new and
  unproven; consolidating a working, simple static rule into a new,
  untested scoring system before the scoring system has any track record
  would risk the COD control's own reliability for no proven benefit.
  Revisit once Risk has real production data.
- **Whether returns/refund patterns should feed back into future risk
  scores** (e.g. an account with an unusual return rate) — not designed
  here; `DOM-RISK` §5 currently only consumes `OrderPlaced`.
- **Threshold tuning** for what score triggers `OrderFlaggedForReview` —
  a starting heuristic with zero production data behind it, same caveat
  `ADR-0004` already states.
- **`DOM-ORDER.md` does not yet exist** — same gap `DOM-SHIPPING` §9
  already named; this domain spec adds a second dependency (Risk) to the
  same not-yet-formalized document.
