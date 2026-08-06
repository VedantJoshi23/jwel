---
id: FEAT-FRAUD-RISK-SCORING
title: Jwel — Feature: Order Fraud/Risk Scoring & Review Queue
version: 0.1.0
status: Proposal
owner: Architecture
reviewers: []
created: 2026-07-09
updated: 2026-07-09
milestone: M6
category: Features
priority: Medium
depends_on:
  - DOM-RISK
  - ADR-0004
required_by: []
related_documents: []
related_domains:
  - DOM-RISK
related_features: []
related_decisions:
  - ADR-0004
tags:
  - feature
  - risk
  - fraud
risk: Medium
complexity: Medium
---

## Feature: Order Fraud/Risk Scoring & Review Queue

> **Deferred 2026-08-06 — proposed, awaiting client feedback.** Recorded via
> `DISC-003` (KC-103, KC-106) after the client was consulted. Status stays
> `Proposal`; this note records *why* it is not being built now, so the
> document is not mistaken for settled-but-neglected work.
>
> **Rationale.** `ADR-0004` was decided when COD was assumed live and cites the
> ₹25,000 first-order COD rule as the existing control. The storefront is
> prepaid-only through Razorpay (KC-105) — COD appears in FAQ copy but exists
> nowhere in the system — so the dominant Indian fraud vectors, COD abuse and
> RTO, are not currently in play. The product is also prelaunch with no real
> orders (KC-001), and §9 requires thresholds tuned against real data; shipping
> untuned thresholds would produce false positives against the first genuine
> customers.
>
> **Revisit triggers** — any one is sufficient:
> 1. COD is actually implemented (changes the risk profile immediately).
> 2. Order volume is sufficient to calibrate thresholds against real data.
> 3. A first real fraud incident.
>
> **Keep cheap in the meantime.** No pre-work is required beyond ensuring the
> `order.confirmed` event payload retains enough detail — account linkage and
> timestamps — for velocity to be reconstructed retrospectively, so scores can
> be backfilled over real history whenever this is switched on.
>
> `ADR-0004` is **not** reversed: rule-based in-house scoring remains the
> chosen approach when this is built.

### 1. Overview

Adds a rule-based risk score to every placed order (velocity, order
value vs. account age, named heuristics per `ADR-0004`), and an admin
review queue for orders that score above threshold — the first fraud
control beyond `DOM-SHIPPING`'s existing static COD-value gate, and the
only one that covers prepaid/card-based fraud and velocity abuse at all.

### 2. Owning Domain

**Owning domain:** `DOM-RISK` — scoring, signal storage, and the review
queue are what this feature is about.

**Other domains involved** (dependency only; Risk is triggered by
Order's event, it never calls Order or any other domain — per
`DOM-RISK` §7):

- **Order** publishes `OrderPlaced`, which Risk consumes to trigger
  scoring; any resulting hold decision an admin makes is applied by
  Order itself in response to `OrderFlaggedForReview`, not a call this
  feature or `DOM-RISK` makes into Order directly.

### 3. Acceptance Criteria

- [ ] Every placed order receives a risk score computed from velocity
      (orders per account in the rolling window), order value relative
      to account age, and the named heuristics in `ADR-0004`/`DOM-RISK`
      §1 — synchronously on `OrderPlaced`, not on a delay (Invariant 2).
- [ ] Orders scoring above the configured threshold appear in an admin
      review queue with the specific signals that contributed to the
      score visible — not just a bare number (Invariant 3).
- [ ] No order is ever auto-cancelled, auto-held, or auto-blocked by this
      feature — every flagged order requires a human resolution
      (Invariant 1); this is tested explicitly (a high-scoring order
      still completes checkout normally).
- [ ] An admin can resolve a flagged order as cleared, confirmed-fraud,
      or held; a held/confirmed-fraud resolution results in Order
      applying the corresponding status change, not Risk mutating
      `orders.status` directly.
- [ ] Two orders from the same account, both pending resolution
      simultaneously, both appear in the queue independently (Edge Case,
      `DOM-RISK` §8) — not merged or overwritten.
- [ ] Resolving an order's flag twice (e.g. two concurrent admin actions)
      is idempotent — the second resolution attempt does not silently
      override the first with a contradictory outcome.
- [ ] The velocity counter uses a rolling window, not a fixed
      calendar-period bucket, so an order placed near a window boundary
      isn't scored inconsistently versus one placed a minute apart
      (`DOM-RISK` §8).

### 4. API Surface

Restated from `DOM-RISK` §4, not reinvented here:
`GET /api/v1/admin/risk/queue`, `POST /api/v1/admin/risk/:orderId/resolve`.
No customer-facing endpoint exists or is planned for this feature.

### 5. Events

#### Publishes

`OrderRiskScored`, `OrderFlaggedForReview` — an exact match to `DOM-RISK`
§5's declared Publishes list.

#### Consumes

`OrderPlaced` only — matches `DOM-RISK` §5 exactly; no new event
introduced at this layer.

### 6. Data Changes

Restated from `DOM-RISK` §6: new tables `order_risk_scores`,
`risk_review_queue`, `account_velocity_counters`. No existing table's
ownership changes.

### 7. Edge Cases & Validations

Restated and made feature-concrete from `DOM-RISK` §8:

1. First-time customer, high-value order — scores and queues for review,
   never treated as auto-confirmed fraud; tested as a "legitimate new
   customer" scenario, not just a "known bad actor" one.
2. Velocity window boundary — tested with two orders straddling the
   rolling-window edge, asserting consistent scoring.
3. Concurrent orders from one account, both pending — both appear
   independently in the queue.
4. Double resolution — second resolve attempt on an already-resolved
   order is rejected or no-ops, never silently overwrites.

### 8. Non-Functional Considerations

Checked against Standards already validated for jwel in Oriveda's
sandbox run (`examples/m4-standards-jwel-walkthrough.md`, corrected by
the M8 audit) plus this project's own `STD-OBSERVABILITY` — jwel does
not yet have STD-API/STD-DATABASE/STD-TESTING formalized in its own
`knowledge/standards/`, flagged here rather than silently assumed
settled (same gap `FEAT-SHIPPING` already named).

| Standard | Relevant? | Notes |
| --- | --- | --- |
| STD-API | Yes | Admin-only endpoints follow the existing role-guarded (`ADMIN`/`STAFF`) convention already used by every other admin surface in this codebase. |
| STD-OBSERVABILITY | Yes | Score distribution and flag-queue volume are exactly the kind of metric `STD-OBSERVABILITY` should require once both exist (a `risk_score_distribution` histogram, `risk_flags_total`) — informs threshold tuning (`DOM-RISK` §9) with real data instead of guesswork. |
| STD-TESTING | Yes | Every Edge Case above needs a real test — this is scoring/branching logic where an untested edge case is exactly where a false-positive or false-negative would hide. |
| Security | Yes | The review queue and resolution endpoint are admin-only and must never be reachable by a customer role — a customer must never see their own or another customer's risk score or flag status (`DOM-RISK` §4's own explicit rule). |
| Accessibility | Yes | The review queue is an admin UI surface; same keyboard/screen-reader bar as every other admin table in this codebase (e.g. the existing Orders/Returns admin lists) — no new pattern, just consistency. |
| Data Portability (NFR-9-equivalent) | Yes | `RiskScoringPort` (per `ADR-0004`) keeps a future SaaS fraud-scoring swap from touching anything outside its own adapter, same shape as every other provider-backed domain in this codebase. |

### 9. Definition of Done

- [ ] `RiskScoringPort` + the initial rule-based implementation
      (velocity, value/account-age, named heuristics), unit-tested with
      each heuristic exercised independently.
- [ ] Prisma migration for `order_risk_scores`, `risk_review_queue`,
      `account_velocity_counters`.
- [ ] Admin review queue UI + resolution flow shipped, role-guarded.
- [ ] Every Edge Case in §7 covered by an explicit test, not just a
      happy-path "order scores low, nothing happens" test.
- [ ] Threshold values (what score triggers a flag) documented as
      starting heuristics, tagged for revisit once real data exists —
      not presented as tuned/final.
- [ ] `README.md`/`BACKEND.md`/`SECURITY.md` updated to reflect this as
      the first implemented fraud control beyond the existing COD gate.
