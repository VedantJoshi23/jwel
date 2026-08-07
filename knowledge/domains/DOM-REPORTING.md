---
id: DOM-REPORTING
title: 'Jwel / ELYSIAN — Domain: Reporting'
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M5
category: Domains
priority: Medium
depends_on:
  - ARCH-001
  - CONSTITUTION
required_by: []
related_documents:
  - DISC-006
related_decisions:
  - ADR-0002
tags:
  - domain
  - reporting
risk: Low
complexity: Low
---

# DOM-REPORTING

**Depth tier: Thin** — a pure read across other contexts, owning no state.

**Thin justification, per `OV-006`:** `DISC-006` found this context reads
`order`, `orderItem`, `review` and `user`, and **writes nothing** (KC-153). It
owns no table and originates no rule; every figure it produces is an aggregation
of another context's truth.

## 1. Overview

Reporting answers business questions — revenue, order counts, average order
value, new customers, low-stock SKUs, orders by status, top products. It is the
one context deliberately permitted to read across every boundary.

## 2. Ownership

**Owns** — aggregation logic and dashboard read models.

**Explicitly does NOT own** — any source data. Every number is derived.

## 3. Invariants

**N/A — derived from Ordering, Catalog, Identity, Inventory and Reviews.**

Two properties:

| # | Property | Source |
| --- | --- | --- |
| 1 | Reporting **never writes.** Cross-boundary reads are permitted here by design; writes are not. | KC-153, `STD-API` exception |
| 2 | Figures are computed on read, from live tables. There is no separate warehouse. | KC-153 |
| 3 | Revenue **excludes cancelled orders entirely** and **deducts refunds**, including partial ones. It is derived, never stored. | Owner decision, 2026-08-07 |
| 4 | Revenue is reported as **three figures — gross, refunds, net** — not one. | Owner decision, 2026-08-07 |

### How Invariants 3 and 4 are computed

```text
gross   = SUM(orders.total_minor_units)            WHERE status <> 'CANCELLED'
refunds = SUM(return_requests.refund_amount_minor_units)
                                                    WHERE status =  'REFUNDED'
net     = gross - refunds
```

**Partial refunds need no special case.** A `DELIVERED` order with one of three
items refunded contributes its full total to `gross` and that item's refund to
`refunds`, netting correctly. A fully refunded order nets to approximately zero
without a branch, because every one of its items appears in `refunds`.

**Nothing is stored.** Per `STD-DATABASE` r9, a stored revenue figure would be a
second source of truth for something the orders and returns tables already know
— the same failure shape as `Product.avgRating` (KC-142).

**Why three figures rather than one.** A single net number that fell last month
is unexplainable; the split says whether trade slowed or returns rose. It costs
one extra aggregate.

**One residual wrinkle.** If a refund amount excludes shipping, a fully refunded
order nets to the shipping cost rather than zero. That is arguably correct — the
shipping was incurred — but it means the figure must be labelled **"net of
refunds"**, not "revenue", or it will read as a rounding error.

## 4. API Surface

`GET /admin/analytics/dashboard?windowDays=` — admin only.

Metabase also queries the database directly for ad hoc analysis (`ADR-0017`).

## 5. Events

**Publishes** — none. **Consumes** — none.

## 6. Data Ownership

**No tables.** Reads `orders`, `order_items`, `users`, `reviews`,
`inventory_items`.

`ARCH-001` §5.2 names Reporting as the natural first consumer of a read replica
when write volume justifies one — it is pure-read, so moving it costs nothing
architecturally.

## 7. Dependencies

**Allowed** — read access to all contexts, by design.

**Forbidden** — any write, anywhere. Emitting events.

## 8. Edge Cases & Validations

1. **Reporting queries competing with checkout for database resources.** The
   mitigation is a read replica (`ARCH-001` §5.2), not query tuning, once
   volume justifies it.
2. **Synthetic test data inflating figures.** The current deployment's orders
   are overwhelmingly test traffic (KC-039, KC-052), so today's dashboard
   describes testing, not trade.
3. **Cancelled and refunded orders in revenue.** **Resolved** by Invariant 3 —
   cancelled excluded outright, refunds deducted.
4. **Partially refunded orders.** **Resolved** by the same formula. They stay
   `DELIVERED` (`DOM-RETURNS` inv. 8) and contribute gross minus the refunded
   portion — which is why deducting from `return_requests` rather than
   branching on order status is the right construction.
5. **A return in `REFUND_PROCESSING`.** Not yet deducted — only `REFUNDED`
   counts (Invariant 3). Money has not moved, so this is correct, but it means
   `net` briefly overstates while refunds are in flight.
6. **`PRODUCT.md` NFR-8 named PostHog**, which does not exist (KC-075). The
   first-party dashboard, Grafana and Metabase are the three real surfaces —
   with no stated division of responsibility between them (`DISC-007`).
7. **Metabase queries the database directly**, bypassing Invariant 3's formula.
   Any revenue figure produced there will disagree with the dashboard unless the
   same exclusions are applied. **Recorded as a gap** — two surfaces, one
   definition, no shared implementation.

## Constitution compliance

Law 1 — §8.2 and §8.5 state what the figures actually describe. Law 2 —
sourced. Law 4 — not applicable. Law 5 — Property 1: reads only.

## Open items

- ~~Edge cases 3 and 4~~ — settled by Invariants 3 and 4.
- **Edge case 7** — Metabase can contradict the dashboard, since it queries
  the database directly and does not share the revenue definition.
- **Three overlapping analytics surfaces** with no stated division
  (`DISC-007` Q5).
