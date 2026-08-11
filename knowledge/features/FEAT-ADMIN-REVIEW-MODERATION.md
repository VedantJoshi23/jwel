---
id: FEAT-ADMIN-REVIEW-MODERATION
title: 'Jwel / ELYSIAN — Feature: Admin Review Moderation UI'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-11
updated: 2026-08-11
milestone: M10
category: Features
priority: High
depends_on:
  - ADR-0002
  - DOM-REVIEWS
required_by: []
related_documents:
  - STD-API
  - STD-ACCESSIBILITY
  - STD-TESTING
related_domains:
  - DOM-REVIEWS
related_decisions: []
tags:
  - feature
  - reviews
  - admin
---

# FEAT-ADMIN-REVIEW-MODERATION

## 1. Overview

`GET /admin/reviews/pending` and `PATCH /admin/reviews/:id/moderate` are real,
working, role-guarded endpoints — built alongside `FEAT-RATING-OWNERSHIP` —
and nothing in the admin frontend has ever called either. `admin/page.tsx`
shows a `Pending reviews` stat card and stops there. In practice this means
**every review submitted since launch is permanently `PENDING`**: there has
never been an operational path to `APPROVED`. Found investigating
`FEAT-PENDING-REVIEW-VISIBILITY`, and deliberately scoped out of it — this is
that follow-up.

This feature is the admin page: list what's pending, approve or reject it,
see the moderated queue shrink.

## 2. Owning Domain

**Owning domain: `DOM-REVIEWS`.** Moderation state is exactly what §2
declares Reviews owns. No new domain call — `adminModerate` already commands
Catalog internally (`ADR-0008`) to recompute the rating aggregate; this
feature adds no additional cross-domain interaction on top of that.

**Dependencies:** none new.

## 3. Acceptance Criteria

1. An admin or staff user can see every `PENDING` review on one page: rating,
   title, body, which product, and who wrote it.
2. Approve and reject are both one click, with a busy state so a slow request
   can't be double-submitted.
3. Approving a review makes it appear on that product's public page and
   recomputes the product's rating aggregate — both already true of
   `adminModerate`; this criterion is "the button reaches the endpoint that's
   already correct," not new business logic.
4. A rejected review's author sees it labelled "Not approved" on the product
   page (`FEAT-PENDING-REVIEW-VISIBILITY`, already built) — this feature does
   not need to build that half, only trigger the state change that surfaces it.
5. The list identifies **which product** by name, not by a raw UUID — a
   moderator deciding whether a review is legitimate needs to know what it's
   about.
6. A customer role (or no session) gets a 403/redirect, matching every other
   admin page.
7. An empty queue says so plainly ("No reviews awaiting moderation") rather
   than rendering nothing.

## 4. API Surface

**Changed** — response shape only, not the route or its contract:

- `GET /admin/reviews/pending` now includes `product: { id, name, slug }` and
  `user: { id, email, name }` on each row. Previously bare FK columns
  (`productId`, `userId`) with no way to render either as text a human can
  act on — Acceptance Criterion 5 is not satisfiable without this. Matches
  the existing precedent (`AdminReturn.orderItem.order.user.email`) rather
  than inventing a new shape.

**Unchanged:**

- `PATCH /admin/reviews/:id/moderate` — request/response untouched.
- Both routes' auth (`@Roles(Role.ADMIN, Role.STAFF)`) and their bare-array
  (not `PaginatedResult`) response shape — pending-review volume doesn't
  need pagination yet, same reasoning `admin-returns.ts` already documents
  for its own list endpoint.

## 5. Events

**Publishes / Consumes:** none directly. `adminModerate` still emits
`product.upserted` from Catalog when it recomputes (`ADR-0008`) — unchanged,
this feature is a new caller of an existing, already-correct path.

## 6. Data Changes

**None.** Same as `FEAT-PENDING-REVIEW-VISIBILITY` §6 — this changes what a
query **returns** (adds two `include`d relations), not what's stored.

## 7. Edge Cases & Validations

1. **Two moderators approve the same review at once.** The second request
   hits `adminModerate`'s existing `NotFoundException`-on-missing-row path
   only if the row's been deleted, not if it's just already `APPROVED` —
   moderating an already-`APPROVED` review re-runs the (idempotent, per
   `FEAT-RATING-OWNERSHIP`) recompute and succeeds harmlessly. Not a new
   failure mode this feature introduces.
2. **A review whose product was since unpublished or soft-deleted.** Still
   shown and still moderatable — `adminListPending` has no product-status
   filter, and it shouldn't gain one: an unpublished product's reviews still
   need a moderation decision, even if approval currently has no visible
   storefront effect until the product republishes.
3. **A review whose author was since soft-deleted.** `user.email`/`name` are
   still fetched — soft-delete doesn't remove the row (`DOM-IDENTITY` inv. 3)
   — so the moderator still sees who wrote it, unlike the public-facing
   anonymous-display rule (`DOM-REVIEWS` Invariant 8), which is a display
   rule for customers, not for moderation.
4. **Reject, not approve.** Must be one click away from approve, not a
   separate confirmation flow — Acceptance Criterion 2's "one click" applies
   equally to both.
5. **Empty queue.** Acceptance Criterion 7.
6. **A moderation call fails mid-request** (network, 500). The row stays in
   the list, busy state clears, an inline error is shown — the row must not
   silently disappear as if it had been handled.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-API`** | `admin/`-prefixed, role-guarded (already true); response envelope unchanged; the `include` addition is the only surface change and is additive, not breaking. |
| **`STD-ACCESSIBILITY`** | Table-based list matches the existing `admin/returns` pattern already in production; approve/reject are real `<button>`s (rule 3 — keyboard operable); status/errors are text, not colour-only (rule 6). |
| **`STD-TESTING`** | Every §7 edge case gets a test. Coverage gate (90%) applies as everywhere else. |
| **`STD-DATABASE`** | No schema change — the `include` uses existing FK relations (`Review.product`, `Review.user`), already indexed via their own primary keys. |

## 9. Definition of Done

- [x] `adminListPending` includes `product` (`id`, `name`, `slug`) and `user`
      (`id`, `email`, `name`) on each row.
- [x] `lib/api/admin-reviews.ts` — `adminListPendingReviews`,
      `adminModerateReview` client functions, matching the
      `lib/api/admin-returns.ts` pattern.
- [x] `app/(admin)/admin/reviews/page.tsx` — list, approve/reject, busy
      state, empty state, inline error — matching `admin/returns/page.tsx`'s
      established shape.
- [x] Nav link added to `admin/layout.tsx`'s sidebar.
- [x] The dashboard's existing "Pending reviews" stat card links through to
      this page.
- [x] Every §7 edge case has a test (2 new API-service, 9 new admin-page,
      3 new API-client). Full suites green: 798 API (Jest), 494 web
      (Vitest, coverage 95.51/97.49/91.39/95.51 — gate is 90%).
- [x] `axe` clean on the new admin page — part of the standing admin-route
      sweep in `e2e/accessibility.spec.ts`.
- [x] `DOM-REVIEWS` Open Items updated (v1.2.0) — the admin-UI gap this
      closes is marked built, not left as a standing note now that it's
      inaccurate.
