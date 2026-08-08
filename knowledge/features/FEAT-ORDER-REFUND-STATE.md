---
id: FEAT-ORDER-REFUND-STATE
title: 'Jwel / ELYSIAN — Feature: Reachable REFUNDED and the Partial-Return Differentiator'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-08
updated: 2026-08-08
milestone: M6
category: Features
priority: High
depends_on:
  - DOM-RETURNS
  - DOM-ORDERING
  - ARCH-001
required_by: []
related_documents:
  - DISC-008
  - STD-API
  - STD-DATABASE
related_domains:
  - DOM-ORDERING
  - DOM-RETURNS
related_decisions:
  - ADR-0008
tags:
  - feature
  - ordering
  - returns
risk: Medium
complexity: Medium
---

# FEAT-ORDER-REFUND-STATE

## 1. Overview

`OrderStatus.REFUNDED` existed in the enum and was **unreachable** (KC-178). No
entry in `ALLOWED_TRANSITIONS` led to it, so an order whose every item had come
back and been refunded still read `DELIVERED`, permanently.

`DOM-RETURNS` invariants 8 and 9 settled what should happen, and both are built
here:

| # | Invariant |
| --- | --- |
| 8 | An order becomes `REFUNDED` only when **every** `OrderItem` has a `REFUNDED` return. A partially refunded order stays `DELIVERED`. |
| 9 | Partial-return state is **derivable and visibly surfaced** to admins, so a `DELIVERED` order carrying refunded items is distinguishable at a glance. |

Invariant 9 is what stops invariant 8's answer being a loss of information.
Without it, an admin looking at a `DELIVERED` order has no way to know part of
it came back without opening it.

## 2. Owning Domain

**Owning domain: `DOM-ORDERING`.** Order status is Ordering's, and
`DOM-RETURNS` §2 is explicit that Returns does not own it.

**Dependencies:**

| Domain | Call | Note |
| --- | --- | --- |
| Returns → Ordering | **Command** — `refreshRefundState(orderId, actor)` | **New.** `DOM-RETURNS` §7 previously listed Ordering as *read, for eligibility*; it is now read **and** command |
| Ordering → Returns | **Read** `return_requests.status` via the item relation | A permitted cross-context read under `STD-API`'s exception clause; never a write |

**Why synchronous command rather than reacting to `return.refunded`.** The bus
is at-most-once (`ARCH-001` §3.1). A lost event would leave an order reading
`DELIVERED` forever with every item refunded — the same silent desync
`ADR-0008` removed from rating aggregates, and for the same reason it is
resolved the same way. The admin who just approved the refund should also see
the order's new state.

## 3. Acceptance Criteria

1. An order becomes `REFUNDED` when, and only when, every item has a
   `REFUNDED` return.
2. `REFUNDED` is **derived, never asserted**. `DELIVERED → REFUNDED` stays out
   of `ALLOWED_TRANSITIONS`, so an admin cannot declare it by hand.
3. A partially refunded order stays `DELIVERED`.
4. The admin order list reports `partiallyReturned` per order.
5. The admin UI renders a `DELIVERED` order that is partially returned
   distinguishably — highlighted status plus a label.
6. The transition is idempotent.
7. The transition is audit-logged against **the admin whose refund decision
   caused it**, not against "system".
8. No new enum value and no new column.

### On criterion 8

`PARTIALLY_REFUNDED` would be the obvious modelling answer and is the wrong
one. It is a schema change rippling through the order state machine, the web
type union and every status filter, to express something the returns attached
to the order already determine. `DOM-RETURNS` §3 records this trade
explicitly; the differentiator lives in the presentation layer instead.

Equally, `partiallyReturned` is **not stored**. It is derived per read, because
storing it would be a second source of truth (`STD-DATABASE` r9) that goes
stale the moment a return advances.

## 4. API Surface

**Changed** — `GET /admin/orders` gains `partiallyReturned: boolean` per order.

**Unchanged** — `PATCH /admin/orders/:id/status` continues to refuse
`REFUNDED`, deliberately (criterion 2). There is no new endpoint: the refund
decision is already made through `PATCH /admin/returns/:id/status`, and the
order state follows from it.

## 5. Events

**Publishes** — none. An order reaching `REFUNDED` announces nothing, because
nothing reacts to it: the customer was already notified by `return.refunded`
when the money moved, and a second message about a status they cannot see
would be noise.

**Consumes** — none.

## 6. Data Changes

**None.** No enum value, no column. This feature makes an existing status
reachable and derives a flag from rows that already exist.

## 7. Edge Cases & Validations

1. **Single-item order, fully refunded.** Complete, not partial. Becomes
   `REFUNDED` and carries no differentiator (`DOM-RETURNS` §8.9). Invariants 8
   and 9 must not both fire.
2. **A `REJECTED` return.** Not a refund. It does not make an order partially
   returned and does not count toward invariant 8 (`DOM-RETURNS` §8.10).
3. **A return still in the lifecycle** — `REQUESTED`, `APPROVED`,
   `REFUND_PROCESSING`. Money has not moved; none of them count.
4. **An order with no items.** `every` on an empty array is true, which would
   make it silently "fully refunded". Guarded explicitly — checkout forbids
   the state, but the arithmetic must not invent it.
5. **The refund gateway call fails.** The order state is never re-derived,
   because the return never reaches `REFUNDED`.
6. **Re-running against an already-`REFUNDED` order.** Conditional update
   matches nothing; no history row, no audit entry.
7. **Items refunded one at a time.** The order flips only on the last one. Each
   earlier refund leaves it `DELIVERED` and partially returned.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-API`** | `partiallyReturned` rides on the existing admin list rather than a second endpoint the UI would have to correlate. |
| **`STD-DATABASE`** | Nothing stored (r9). Both invariants derive from `return_requests`, which already holds the truth. |
| **`STD-TESTING`** | The derivation is a pure function over item return states, so every §7 case is testable without a database (r6). |
| **`STD-PERFORMANCE`** | `returnRequest` is 1:1 on `order_items` and rides along in the existing include — no N+1. |

**Law 5 check.** Returns commands Ordering and reads nothing it writes;
Ordering owns the status change and the history row. **Law 1 check.** An order
reading `DELIVERED` when every item has been refunded asserts something untrue,
and one reading `DELIVERED` when half came back conceals something true.

## 9. Definition of Done

Verified against a scratch Postgres with a live API and a two-item delivered
order, refunded one item at a time through the real admin endpoints:

| Case | Result |
| --- | --- |
| Before any refund | `DELIVERED`, `partiallyReturned: false` |
| First of two items refunded | `DELIVERED`, `partiallyReturned: **true**` |
| Second item refunded | `REFUNDED`, `partiallyReturned: false` |
| Status history | `DELIVERED`, then `REFUNDED — "Every item on this order has been refunded"` |
| `PATCH /admin/orders/:id/status` to `REFUNDED` on a `DELIVERED` order | **400** — *"Cannot transition order from DELIVERED to REFUNDED"* |

- [x] `refreshRefundState` on Ordering; Returns commands it.
- [x] `DELIVERED → REFUNDED` absent from `ALLOWED_TRANSITIONS`, so the derived
      path is the only one.
- [x] Idempotent by conditional update.
- [x] Audited against the approving admin, with `derived: true`.
- [x] `partiallyReturned` on the admin order list, derived per read.
- [x] Admin UI highlights the status and labels it.
- [x] Every §7 edge case covered by a test (8 on the derivation, 7 on the
      service, 3 on Returns' command, 4 on the UI).
- [x] `DOM-RETURNS` §7 updated — Ordering is now read **and** command.
- [x] `DOM-ORDERING` updated — invariant 10 and the transition table.
