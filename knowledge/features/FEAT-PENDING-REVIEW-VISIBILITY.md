---
id: FEAT-PENDING-REVIEW-VISIBILITY
title: 'Jwel / ELYSIAN — Feature: A Reviewer Sees Their Own Pending Review'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-11
updated: 2026-08-11
milestone: M8
category: Features
priority: Medium
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
  - ux
---

# FEAT-PENDING-REVIEW-VISIBILITY

## 1. Overview

A customer submits a review; `DOM-REVIEWS` Invariant 3 correctly holds it
`PENDING` and out of public view until an admin moderates it. Today that
means the reviewer sees *nothing* — no confirmation beyond a toast that
fades in seconds, and the product page looks exactly as it did before they
wrote anything. Reported directly: *"I wrote a review, but I can't see it
anywhere."*

This is compounded by a second, unrelated gap this feature does not fix:
the admin side has moderation endpoints (`DOM-REVIEWS` §4) but no UI that
calls them, so nothing currently exits `PENDING` at all. The owner has
scoped that separately — tracked, not built here.

**External research** (Amazon's review pipeline; WooCommerce, the most
widely deployed self-hosted storefront) confirms the fix is the established
pattern, not a novel one: the *author* sees their own submission immediately,
labelled as pending; every other visitor keeps seeing only what's approved.
WooCommerce's own copy for this is close to verbatim what this feature
implements: *"Your review is awaiting approval."*

## 2. Owning Domain

**Owning domain: `DOM-REVIEWS`.** The change is entirely about who may see a
`Review` row before it is moderated — squarely inside what Reviews already
owns (§2: "Reviews owns what customers say about products and whether it is
shown").

**Dependencies:** none new. No other domain is called. The rating aggregate
(`Product.avgRating`, owned by Catalog per `ADR-0008`/`FEAT-RATING-OWNERSHIP`)
is untouched — a self-viewed pending review is not counted, exactly as today.

## 3. Acceptance Criteria

1. After submitting a review, its author sees it on the product page in the
   same session and on any later visit, before moderation — labelled
   distinctly (e.g. "Pending approval — visible only to you until it's
   reviewed"), never mixed into the public list unlabelled.
2. No other visitor — anonymous or a different logged-in customer — can see
   a review before it is `APPROVED`, under any code path. This is the one
   thing this feature must not weaken.
3. A `REJECTED` review remains visible to its own author too (not just
   `PENDING`), labelled accordingly — an author who was told "submitted" and
   then sees it silently vanish forever is a worse experience than the one
   this feature fixes.
4. The public review list, its pagination, and the rating aggregate are
   byte-for-byte unchanged for every visitor who is not the review's author.
5. Works for a review on any product, including one where the author's
   review is the *only* review that product has (today: an empty list; after:
   one review, correctly labelled, and still excluded from `avgRating`).

## 4. API Surface

**New** — customer, authenticated:

- `GET /reviews/mine?productId=` — the current user's own review for that
  product, in any moderation state, or `null`/`404` if they have not
  reviewed it. Not paginated (`STD-API` r5 does not apply — this is a
  single-row lookup by the unique `(productId, userId)` constraint
  `DOM-REVIEWS` §6 already declares, not a list).

**Unchanged:**

- `GET /products/:productId/reviews` stays `@Public()`, stays filtered to
  `APPROVED` only, takes no auth context. Deliberately not modified to
  "also return the caller's own pending review inline" — that would couple
  a cacheable public list's shape to per-caller identity, for a case one new
  single-row endpoint already covers with no such coupling. The frontend
  calls both and merges client-side.
- `POST /reviews`, the admin moderation endpoints — untouched.

## 5. Events

**Publishes:** none. **Consumes:** none. Matches `DOM-REVIEWS` §5 exactly —
this feature adds a read path, not a write or a side effect.

## 6. Data Changes

**None.** The `reviews` table, its unique constraint, and its moderation
states already carry everything this needs. This feature changes **who may
read a row**, not what is stored — same shape as `FEAT-RATING-OWNERSHIP`
§6's "changes who writes them, not what is stored."

## 7. Edge Cases & Validations

1. **Anonymous visitor requests `/reviews/mine`.** 401 — the endpoint is
   authenticated, unlike the public list.
2. **Logged-in user with no review for this product.** `404`/`null`, not an
   error — "you haven't reviewed this yet" is a normal state, not a failure.
3. **The review is `APPROVED`.** Still returned by `/reviews/mine` (so the
   frontend has one source for "my review, whatever its state"), but the
   frontend must not render it twice — it already appears in the public
   list. De-duplicate by review id, prefer the public-list copy when both
   are present.
4. **The review is `REJECTED`.** Returned, and displayed to the author per
   Acceptance Criterion 3 — distinctly labelled, not silently dropped.
5. **Product has zero approved reviews but the caller has a pending one.**
   The "No reviews yet" empty state must not show alongside the caller's own
   pending review as a contradiction — the pending review's presence
   replaces the empty state for that visitor.
6. **A second browser tab / different account.** `/reviews/mine` is scoped
   to the bearer token's `userId` via the same unique constraint Invariant 5
   already enforces — no session bleed between accounts is possible without
   also breaking that constraint.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-API`** | New endpoint is authenticated (not `admin/`-prefixed — this is a customer surface), returns the standard error envelope on 401/404, and is deliberately unpaginated per §4's reasoning. |
| **`STD-ACCESSIBILITY`** | The "pending" label is text (rule 6 — never colour alone), and is announced the same way existing review-submission feedback already is (`role="status"`, matching `review-form.tsx`'s existing pattern) — not a new pattern to separately verify. |
| **`STD-TESTING`** | Every §7 edge case gets a test (r6). Co-located: `reviews.service.spec.ts` (backend), a new frontend test alongside wherever the merge/label logic lands. Coverage gate (r2) applies as everywhere else — no exclusions. |
| **`STD-DATABASE`** | No schema change — the existing `(productId, userId)` unique index is what makes `/reviews/mine` a cheap, single-row lookup. |

## 9. Definition of Done

- [x] `GET /reviews/mine?productId=` implemented, authenticated, returns the
      caller's review in any state or 404. Verified against a real Postgres
      database, not just mocks: 404 before a review exists, `PENDING`
      immediately after submission, correctly excluded from the public list
      while pending, flips to visible in the public list (and silently drops
      out of `/reviews/mine`'s rendered surface) once an admin approves it.
- [x] PDP review section fetches both the public list and (when logged in)
      the caller's own review, merges without duplication, and labels a
      non-`APPROVED` result distinctly. Confirmed in a real browser against
      the live API: a `PENDING` review renders in its own card ("Pending
      approval", "Visible only to you until our team reviews it.") above the
      public list, which separately and correctly shows an unrelated
      `APPROVED` review with no special treatment.
- [x] Every §7 edge case has a test (20 new: 6 API service/controller, 6
      frontend API-client, 9 across `MyReviewStatus`/`ReviewForm`); existing
      `GET /products/:productId/reviews` tests unchanged and still passing
      (proves Acceptance Criterion 4). Full suites green: 802 API (Jest),
      520 web (Vitest, coverage 96.96/97/91.41/96.96 — gate is 90%).
- [x] `axe` clean on the product page — part of the standing WCAG 2.1 AA
      public-page sweep, re-run after this change.
- [x] `DOM-REVIEWS` amended to v1.2.0 (Invariant 3's "invisible until
      moderated" narrowed to "invisible to the public"; §4 API surface
      updated; admin-UI gap recorded under Open items), per Law 3 — done
      alongside this spec, not left implicit.
- [x] Admin moderation UI explicitly **out of scope** — noted here and in
      `DOM-REVIEWS` Open items so its absence reads as a tracked decision,
      not an oversight (Law 1).
