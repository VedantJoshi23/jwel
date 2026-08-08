---
id: FEAT-REVENUE-FORMULA
title: 'Jwel / ELYSIAN — Feature: Gross, Refunds and Net'
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
  - DOM-REPORTING
  - DOM-RETURNS
required_by: []
related_documents:
  - DISC-007
  - STD-DATABASE
related_domains:
  - DOM-REPORTING
related_decisions:
  - ADR-0017
tags:
  - feature
  - reporting
risk: Medium
complexity: Low
---

# FEAT-REVENUE-FORMULA

## 1. Overview

The admin dashboard reported **one** figure and called it *Revenue*. It was the
sum of non-cancelled order totals with **no refund deducted**, so a month in
which half the goods came back read exactly like a month in which none did.

`DOM-REPORTING` invariants 3 and 4 settled what it should say. Both are built
here.

## 2. Owning Domain

**Owning domain: `DOM-REPORTING`**, which owns aggregation logic and owns no
source data. Every number here is derived, and this feature adds no exception.

**Dependencies** — read-only across contexts, which is Reporting's defining
permission (Property 1). It now reads `return_requests` alongside `orders`.

## 3. Acceptance Criteria

1. Revenue is reported as **three figures — gross, refunds, net** — never one.
2. Gross excludes cancelled orders entirely.
3. Refunds count **only** `REFUNDED` returns.
4. Net is `gross - refunds`, and is **not clamped at zero**.
5. Nothing is stored. Every figure is computed on read.
6. Average order value stays on **gross**.
7. Top products rank on **net**.
8. The UI labels the third figure **"net of refunds"**, not "revenue".

### On criteria 6 and 7, which pull in different directions

**AOV stays gross** because it answers *what does a customer typically spend* —
a purchasing decision, made before any return exists. Netting it would blend two
questions.

**Top products rank net** because that list answers *what should we restock and
promote*. Ranking on gross would put a heavily-returned product at the top of
the list used to decide what to buy more of — the one place ignoring returns
does active harm rather than merely overstating a total. Each product also
carries its own gross and refunds, so a high-return line is visible rather than
merely demoted.

## 4. API Surface

**Changed** — `GET /admin/analytics/dashboard`

- `revenueMinorUnits` → **removed**, replaced by `grossMinorUnits`,
  `refundsMinorUnits`, `netMinorUnits`.
- Each `topProducts` entry gains the same three, replacing `revenueMinorUnits`.

A rename rather than an addition, deliberately. Leaving `revenueMinorUnits` in
place beside the new fields would leave the misleading number available to any
caller who did not read the changelog — which is exactly how it got shown for
this long. The only consumer is the admin dashboard, updated in the same
change.

## 5. Events / 6. Data Changes

**None, and none.** Reporting publishes and consumes nothing, and stores
nothing. A stored revenue figure would be a second source of truth for
something `orders` and `return_requests` already know — the same failure shape
as `Product.avgRating` (KC-142), fixed in `FEAT-RATING-OWNERSHIP`.

## 7. Edge Cases & Validations

1. **A partially refunded order.** Contributes its **full total** to gross and
   the refunded portion to refunds. No branch on order status — that is the
   point of deducting from returns.
2. **A fully refunded order.** Nets to approximately zero without a special
   case, because every one of its items appears in refunds.
3. **A return in `REFUND_PROCESSING`.** Not deducted. Money has not moved, so
   this is correct, but it means net briefly overstates while refunds are in
   flight (`DOM-REPORTING` §8.5).
4. **Refunds exceeding gross.** Reported as a negative net rather than clamped.
   A window with few orders and large refunds against them is a real and
   alarming state; a floor of zero would be the dashboard lying to protect its
   own appearance.
5. **No orders in the window.** All three figures zero, AOV zero rather than
   `NaN`.
6. **A refund amount that excludes shipping.** A fully refunded order nets to
   the shipping cost rather than zero. Arguably correct — the shipping was
   incurred — which is precisely why the label reads *net of refunds*.
7. **A single-item order refunded for less than its total.** Observed during
   verification and worth stating plainly, because two things that sound like
   "fully refunded" are not the same:

   | Question | Answer comes from |
   | --- | --- |
   | Did everything come back? | **Items** with a `REFUNDED` return → `Order.status` |
   | How much money went back? | **Amounts** on those returns → the refunds figure |

   So an order can read `REFUNDED` while its refund was partial in money terms.
   That is `DOM-RETURNS` invariant 8 working as written — it counts items, not
   rupees — and it is the same wrinkle as case 6 seen from the other side.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-DATABASE`** | Nothing stored (r9). One extra aggregate per dashboard read. |
| **`STD-TESTING`** | The formula is a pure function, so every §7 case is testable without a database (r6). |
| **`STD-PERFORMANCE`** | One added aggregate on the dashboard query; `returnRequest` is 1:1 on `order_items` and rides along in the existing include for top products, so no N+1. |
| **`STD-CODE`** | One definition of the formula, not one per surface. |

**Law 1 check.** A figure labelled *Revenue* that ignores refunds is a surface
asserting something the business did not earn. That is this feature in one
sentence.

## 9. Definition of Done

Verified against a scratch Postgres with real orders and returns, through the
live admin endpoint:

| Case | Result |
| --- | --- |
| Three non-cancelled orders totalling ₹9,996 | gross **999600** |
| One of them fully refunded (both items) | refunds **499800**, net **499800** |
| A further **partial** refund of ₹1,000 on another order | gross **unchanged at 999600**, refunds **599800**, net **399800** |
| Top products | ranked on net, carrying gross and refunds per product |
| Old behaviour on the same data | would have reported **999600** as "Revenue" — 2.5× the truth |

- [x] `gross`, `refunds`, `net` on the dashboard; `revenueMinorUnits` removed.
- [x] Only `REFUNDED` returns deducted.
- [x] Net not clamped at zero.
- [x] AOV on gross; top products ranked on net, each carrying its own three.
- [x] UI shows three cards and labels the third *Net of refunds*.
- [x] Every §7 edge case covered by a test (9 on the formula, 10 on the
      service, 4 on the UI).
- [x] `DOM-REPORTING` updated — invariants 3 and 4 marked built.

## 10. What this did not close

**`DOM-REPORTING` §8.7 — Metabase still bypasses this definition.** It queries
the database directly (`ADR-0017`), so any revenue figure produced there will
disagree with the dashboard unless someone reapplies the exclusions by hand.
Two surfaces, one definition, no shared implementation.

This feature makes the disagreement **larger**, not smaller: the dashboard now
deducts refunds and Metabase does not, so the two will differ by the refund
total rather than agreeing on a number that was wrong in the same way.

The fix is a database **view** carrying the formula, which both the API and
Metabase read — the only construction where the definition cannot drift. Not
built here: it needs a hand-written migration (`prisma migrate dev` cannot diff
this schema, KC-144) and turns the dashboard query into raw SQL, which is a
larger change than this feature's scope and worth deciding on its own merits.

**Recorded as still open**, with the recommendation stated, rather than left to
be discovered when two numbers disagree in a meeting.
