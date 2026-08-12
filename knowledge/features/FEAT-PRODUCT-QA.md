---
id: FEAT-PRODUCT-QA
title: 'Jwel / ELYSIAN — Feature: Product Q&A'
version: 0.1.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-12
updated: 2026-08-12
milestone: M10
category: Features
priority: High
depends_on:
  - ADR-0021
  - DOM-PRODUCT-QA
required_by: []
related_documents:
  - STD-API
  - STD-ACCESSIBILITY
  - STD-TESTING
  - STD-DATABASE
related_domains:
  - DOM-PRODUCT-QA
related_decisions:
  - ADR-0021
tags:
  - feature
  - qa
---

# FEAT-PRODUCT-QA

## 1. Overview

A public, per-product question-and-answer thread — customers ask questions
about a product, and either the store (admin) or other customers can answer.
Both questions and answers can be upvoted. Nothing waits for approval before
it's visible; the admin moderates reactively by hiding a question or answer
after the fact. Lives directly under the product detail page — no separate
route.

## 2. Owning Domain

**Owning domain: `DOM-PRODUCT-QA`.** New context, declared by `ADR-0021`. No
other domain co-owns any part of this feature. Catalog and Identity are
read-only dependencies (product display, user display) — the same
already-allowed relationship `DOM-REVIEWS` has with both.

## 3. Acceptance Criteria

1. On a product detail page, any visitor (logged in or not) can read every
   visible question and its visible answers, with each one's upvote count.
2. A logged-in customer can ask a question. It appears immediately — no
   approval wait.
3. A logged-in customer **or the admin** can answer any question, through the
   same action — an admin's answer is visually badged as being from the
   store, derived from their role, not a separate flow.
4. A logged-in user can upvote a question or an answer once; doing it again
   removes their upvote (a toggle, not a one-way action).
5. An admin can hide a question (taking its whole thread down) or hide a
   single answer (leaving the question and its other answers up), and can
   reverse either.
6. The admin has a page listing questions **with enough product context to
   answer responsibly without leaving the page** — product name, photo, and a
   link to the product — because the admin did not necessarily read this
   question in the context of browsing that product. This is the client's
   explicit requirement, not an inferred nice-to-have.
7. The admin can filter that list to unanswered questions, since with no
   approval queue, "needs an answer" is the actual worklist (unlike Reviews'
   "needs approval" queue).
8. A customer role gets 401/403 on any write action taken while logged out;
   read access is unaffected, matching Acceptance Criterion 1.

## 4. API Surface

Restated from `DOM-PRODUCT-QA` §4 (authoritative there; this section names
which routes this feature builds, not a new surface):

**Customer**:
- `GET /products/:productId/questions` — paginated (`STD-API` rule 5), public.
- `POST /products/:productId/questions` — authenticated.
- `POST /questions/:questionId/answers` — authenticated (admin and customer
  both use this route).
- `POST` / `DELETE /questions/:questionId/upvote` — authenticated.
- `POST` / `DELETE /answers/:answerId/upvote` — authenticated.

**Admin**:
- `GET /admin/qa/questions?unanswered=` — paginated, role-guarded
  (`Role.ADMIN`, `Role.STAFF`), `include`s `product: { id, name, slug,
  image }` and `user: { id, name, email }` on the question and each answer.
- `PATCH /admin/qa/questions/:id/moderate` — `{ hidden: boolean }`.
- `PATCH /admin/qa/answers/:id/moderate` — `{ hidden: boolean }`.

**Why paginated here, unlike `admin/reviews/pending`'s bare array.**
`FEAT-ADMIN-REVIEW-MODERATION` justified skipping pagination on the grounds
of low pending-review volume, bounded by how fast admins clear the queue.
Q&A has no clearing mechanism that shrinks it — an answered question stays
in the list forever — so volume only grows. `STD-API` rule 5 applies without
a volume-based exception here.

## 5. Events

**Publishes / Consumes:** none, per `DOM-PRODUCT-QA` §5. Nothing outside this
feature reacts to a question being asked, answered, hidden, or upvoted.

## 6. Data Changes

Four new tables, all owned by `DOM-PRODUCT-QA` §6:

- **`questions`** — `id` (uuid, pk), `product_id` (fk → `products`),
  `user_id` (fk → `users`), `body` (text), `is_hidden` (boolean, default
  `false`), `created_at`, `updated_at`. Index `(product_id, created_at DESC)`.
- **`answers`** — `id` (uuid, pk), `question_id` (fk → `questions`),
  `user_id` (fk → `users`), `body` (text), `is_hidden` (boolean, default
  `false`), `created_at`, `updated_at`. Index `(question_id, created_at ASC)`.
- **`question_upvotes`** — `id` (uuid, pk), `question_id` (fk), `user_id`
  (fk), `created_at`. Unique `(question_id, user_id)`.
- **`answer_upvotes`** — `id` (uuid, pk), `answer_id` (fk), `user_id` (fk),
  `created_at`. Unique `(answer_id, user_id)`.

No existing table changes. No soft-delete column (`deletedAt`) on `questions`
or `answers` — `is_hidden` is the moderation mechanism (reversible, per
Invariant 3/4), the same way `Review.moderationStatus` is Reviews' mechanism
rather than a `deletedAt`. `STD-DATABASE` rule 8's soft-delete convention
targets primary user-visible entities (Product, User, Order); Reviews already
established the precedent that moderated user-generated content uses its own
status field instead.

## 7. Edge Cases & Validations

Restated from `DOM-PRODUCT-QA` §8 — see that document for the full list and
reasoning. The eight cases there (unpublished product, soft-deleted author,
duplicate-upvote race, empty body, hide-cascade interactions in both
directions, anonymous read access, admin answering their own product) are
this feature's edge-case surface; no additional ones are introduced by
implementation.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-API`** | Versioned under `/api/v1` (rule 1); admin routes `admin/`-prefixed and role-guarded (rule 2); DTOs validated (rule 3); standard error envelope (rule 4); **paginated** (rule 5, see §4's reasoning); no cross-context command exists to violate rule 6; no external vendor involved (rule 7 N/A). |
| **`STD-ACCESSIBILITY`** | New public surface (the product page's Q&A section) and one new admin route (`/admin/qa`) — both join the standing `axe` sweep in `e2e/accessibility.spec.ts`. Upvote buttons are real `<button>`s with an accessible name stating the current count, not an icon alone (rule 6, colour is never the sole carrier of meaning — applies here to "upvoted" state too, which must not be colour-only). The ask/answer forms label their inputs (rule 7). |
| **`STD-TESTING`** | Every edge case in `DOM-PRODUCT-QA` §8 gets a test. Coverage gate (90%) applies as everywhere else, both apps. |
| **`STD-DATABASE`** | Money is not involved (rule 1 N/A). Rule 3 (append-only history) doesn't apply — questions/answers are mutable-by-hide, not a history log. Rule 4: `is_hidden`'s default and the upvote uniqueness are both expressed at the schema layer, not just application code. Rule 8: UUID primary keys; soft-delete reasoning addressed in §6 above. |

## 9. Definition of Done

- [ ] `questions`, `answers`, `question_upvotes`, `answer_upvotes` migrated.
- [ ] `apps/api/src/modules/qa/` — service + controller for both customer and
      admin routes in §4.
- [ ] `lib/api/qa.ts` (customer) and `lib/api/admin-qa.ts` (admin) — client
      functions, matching the existing `lib/api/reviews.ts` /
      `lib/api/admin-reviews.ts` pattern.
- [ ] Product detail page — a Q&A section: question list, ask-a-question
      form (authenticated), answer form per question (authenticated), upvote
      buttons on both, "Verified by the store" badge on admin answers.
- [ ] `app/(admin)/admin/qa/page.tsx` — list with product photo/link, answer
      inline, hide/unhide question and answer, unanswered filter.
- [ ] Nav link added to `admin/layout.tsx`'s sidebar.
- [ ] Every `DOM-PRODUCT-QA` §8 edge case has a test.
- [ ] `axe` clean on the product page's Q&A section and `/admin/qa` — added
      to the standing sweeps in `e2e/accessibility.spec.ts`.
- [ ] Full suites green, both apps, 90% coverage gate.
