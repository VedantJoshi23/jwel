---
id: DOM-RECOMMENDATION
title: 'Jwel / ELYSIAN — Domain: Recommendation'
version: 1.1.0
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
  - DISC-005
  - DISC-008
related_decisions:
  - ADR-0010
tags:
  - domain
  - recommendation
risk: Medium
complexity: Medium
---

# DOM-RECOMMENDATION

**Depth tier: Full** — owns behavioural data and ranking logic, despite reading
widely.

## 1. Overview

Recommendation owns the signals behind "recommended for you", "frequently
bought together", "trending" and "recently viewed". It is `PRODUCT.md`'s single
designated MVP differentiator, built entirely on first-party behavioural data
rather than a bought-in service.

## 2. Ownership

**Owns** — `ProductView` (append-only view log), `ProductCoOccurrence`
(materialised pair counts), and all ranking logic.

**Explicitly does NOT own** — product truth (Catalog); order truth (Ordering);
the storefront surfaces that would display recommendations.

## 3. Invariants

| # | Invariant | Source |
| --- | --- | --- |
| 1 | `ProductView` is an **append-only event log**, not a deduplicated "last viewed" row — recency ranking needs the full history. | KC-133, schema |
| 2 | Exactly one of `userId` or `anonymousId` is set on a view. **Enforced in the service only** — Prisma cannot express the XOR. | KC-143 |
| 3 | `anonymousId` is a client-generated identifier, **never a real identity**, and must not be joinable to a person. | schema, `STD-SECURITY` |
| 4 | `ProductCoOccurrence` stores each unordered pair once: `productAId` is always the lexicographically smaller id. | KC-135 |
| 5 | Co-occurrence is maintained incrementally on `order.confirmed` — the only precomputed signal. Trending and personalised results are computed on read. | KC-150 |
| 6 | Co-occurrence must be **recomputable in bulk** from order history, because the event bus is at-most-once. | `ARCH-001` §3.1, `ADR-0010` |
| 7 | Recommendations never write to Catalog or Ordering. | Law 5 |
| 8 | A product pair is only recommendable at **co-occurrence count >= 5**. Below that threshold the pair is treated as noise and not surfaced. The value is a starting heuristic to be tuned against real data, not a tuned figure. **Built 2026-08-09** (`FEAT-RECOMMENDATION-RAILS`) as the setting `recommendations.min_co_occurrence` — a heuristic meant to be tuned should not need a deploy to change. | Owner decision, 2026-08-07 |
| 9 | A guest's `anonymousId` view history **transfers to the user on registration when it is the same session**, so first-session personalisation survives sign-up. **Built 2026-08-09** (`FEAT-GUEST-VIEW-CLAIM`). Identity commands Recommendation; "same session" is expressed as a 24-hour recency bound, since the server has no session for a guest. | Owner decision, 2026-08-07 |

**Invariant 8 is a minimum-support rule, deliberately not a confidence rule.**
The problem it solves is sparse-data noise: with two published products, a
single shared order makes them look perfectly correlated. A confidence
threshold — "of everyone who bought A, X% also bought B" — does not catch that,
because one order produces 100% confidence. A minimum count does.

The threshold is explicitly a **starting heuristic**, per `FEAT-FRAUD-RISK-
SCORING`'s precedent of not presenting untuned numbers as tuned. It should be
revisited once real order volume exists; 5 co-occurrences is a guess about a
catalog that currently has almost no orders.

**Invariant 6 is the mitigation `ADR-0010` prefers over durability.** A lost
`order.confirmed` means one order's pairs are missing from the matrix. The
admin backfill endpoint exists precisely so the effect is re-derivable rather
than the event being made durable.

## 4. API Surface

`GET /me/recommendations`, `GET /recommendations/trending`,
`GET /products/:productId/recommendations/frequently-bought-together`,
`GET /recently-viewed`, `POST /admin/recommendations/backfill-co-occurrence`.

**None of these are called by the storefront** (KC-118). Six endpoints, zero UI
— for the feature `PRODUCT.md` chose *because* the wireframe already had slots
for it. Surfacing them is agreed (KC-123).

## 5. Events

**Publishes** — none.
**Consumes** — `order.confirmed`, from Ordering.

## 6. Data Ownership

`product_views` (indexed `(userId, viewedAt DESC)` and
`(anonymousId, viewedAt DESC)`), `product_co_occurrences` (unique
`(productAId, productBId)`).

**Reads, does not own:** `orders`, `order_items`, `products`,
`product_variants`. `DISC-006` found this the widest table reach of any context
(KC-154) — inherent to the domain, since co-occurrence is computed from order
history and personalisation from views joined to catalog.

## 7. Dependencies

**Allowed** — Catalog (read), Ordering (read).

**Forbidden** — writing any table outside its own two; emitting events;
depending on Payments, Returns, Reviews or Shopping.

## 8. Edge Cases & Validations

1. **Cold start — a new user with no views.** Must degrade to trending, not
   return empty.
2. **Sparse catalog.** With two published products, co-occurrence is
   meaningless. **Resolved** by Invariant 8's minimum support of 5. Note the
   consequence: at current data volume the frequently-bought-together rail will
   correctly render **empty**, and the UI must handle that rather than showing
   a broken section.

   *Enforced 2026-08-09.* The service used to top the rail up with
   same-category bestsellers whenever co-occurrence returned too few — which
   defeated Invariant 8 in practice (a filtered-out pair returned through the
   fallback) and made a heading saying *frequently bought together* describe
   items nobody bought together. The fallback is gone; the rail renders
   nothing, and the UI handles that.
3. **A view logged with neither `userId` nor `anonymousId`.** Rejected by the
   service (Invariant 2); the database would accept it.
4. **Lost `order.confirmed`.** Pairs are missing until a backfill (Invariant 6).
5. **Recommending an unpublished or deleted product.** Results must be filtered
   through Catalog's visibility rules, not served from stale co-occurrence rows.
6. **Guest views then registers.** History transfers when it is the same
   session (Invariant 9). Across sessions it does not — an `anonymousId` from a
   different browser or a much earlier visit is not claimable, since there is no
   basis to believe it is the same person.

   *Built 2026-08-09.* Same **browser** is guaranteed by construction: the
   client sends the id out of its own `localStorage`. The 24-hour bound is
   what limits a **forged** id — one travels in a registration payload, and an
   unbounded claim would let anyone who learned another person's id inherit
   their browsing history through the recommendations it produces. Verified: a
   view backdated three days is left unclaimed while a same-day view under the
   same id transfers.

   **Login is not covered**, only registration, which is what the invariant
   says. A returning customer who browses as a guest and then signs in to an
   existing account leaves those views behind — recorded rather than assumed.
7. **Widest schema exposure.** This domain reads four other contexts' tables
   (KC-154), so a schema change elsewhere breaks it first.

## Constitution compliance

Law 1 — §4 states the endpoints are unreached rather than implying a live
feature. Law 2 — sourced. Law 4 — Invariant 2's limitation is documented, per
`STD-DATABASE` r6. Law 5 — read-only across boundaries.

## Open items

- ~~**No storefront surface exists** (KC-118, KC-123)~~ — **built
  2026-08-09** (`FEAT-RECOMMENDATION-RAILS`): view tracking, frequently-bought-
  together, recently-viewed, trending and personalised rails.
- ~~Edge case 2~~ — settled: minimum support of 5 (Invariant 8).
- ~~Edge case 6~~ — settled: same-session transfer (Invariant 9).
- **Invariant 8's threshold needs tuning** once real order volume exists.
