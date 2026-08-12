---
id: DOM-PRODUCT-QA
title: 'Jwel / ELYSIAN — Domain: Product Q&A'
version: 0.1.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-12
updated: 2026-08-12
milestone: M5
category: Domains
priority: High
depends_on:
  - ARCH-001
  - CONSTITUTION
required_by:
  - FEAT-PRODUCT-QA
related_documents:
  - DOM-REVIEWS
related_decisions:
  - ADR-0021
tags:
  - domain
  - qa
risk: Medium
complexity: Medium
---

# DOM-PRODUCT-QA

**Depth tier: Full** — owns Q&A content, moderation, and upvotes; imminent,
non-trivial work (`ADR-0009`'s "depth follows work" precedent).

## 1. Overview

Product Q&A owns the public, per-product question-and-answer conversation:
customers ask questions, the admin or other customers may answer, and either
can be upvoted. It does not own product truth or user identity — it reads
both to display context, the same way `DOM-REVIEWS` already reads them.

## 2. Ownership

**Owns** — `Question`, `Answer`, `QuestionUpvote`, `AnswerUpvote`, and each
question's/answer's visibility state (`isHidden`, reactive moderation).

**Explicitly does NOT own** — product identity, name, slug, or image
(Catalog); user identity or display name (Identity); review content or
ratings (Reviews — this domain does not touch `DOM-REVIEWS` in any way).

## 3. Invariants

| # | Invariant | Source |
| --- | --- | --- |
| 1 | Any authenticated user may ask a question or post an answer on any product — no purchase gate, no pre-approval. It is visible the instant it's created. | Owner decision, 2026-08-12; `ADR-0021` |
| 2 | Moderation is **reactive**, not a pre-approval gate: an admin may hide a question or answer after the fact. There is no `PENDING` state — this is the deliberate departure from `DOM-REVIEWS` Invariant 3 that `ADR-0021` records. | Owner decision, 2026-08-12; `ADR-0021` |
| 3 | Hiding a **question** hides its entire thread (the question and every answer under it) from public view, regardless of each answer's own `isHidden` value. Hiding a single **answer** hides only that answer; the question and its other answers stay visible. | Owner decision, 2026-08-12 |
| 4 | Un-hiding a question does **not** un-hide answers that were individually hidden before or during the question's hidden period — each row's `isHidden` is independent state, not derived from its parent at write time. | Owner decision, 2026-08-12 |
| 5 | A user may upvote a given question or answer **at most once**, enforced by a unique constraint on `(questionId, userId)` / `(answerId, userId)`. Upvoting is a toggle — casting it again removes it. | Owner decision, 2026-08-12 |
| 6 | Whether an answer is **"by the store"** is determined by the answerer's **current** role at read time (a live join to Identity), not snapshotted at write time. | Owner decision, 2026-08-12 — consistent with roles being a live fact, not a historical one |
| 7 | A soft-deleted user's questions and answers remain, displayed anonymously — same display rule as `DOM-REVIEWS` Invariant 8. | Consistency with `DOM-REVIEWS` Invariant 8; `DOM-IDENTITY` Invariant 3 (soft-delete) |
| 8 | The Q&A thread is publicly readable without authentication (Invariant per `ADR-0021`'s "public per-product, no separate page"); asking, answering, and upvoting require an authenticated user, the same gate `DOM-REVIEWS` applies to submitting a review. | Owner decision, 2026-08-12 |

**Invariant 1 is the load-bearing departure this whole domain exists for.**
`DOM-REVIEWS` Invariant 1 already established "no purchase gate" for
user-generated product content; this domain goes one step further and removes
the moderation gate too, because a Discord-shaped conversation that waits for
approval before anyone can see a reply is not the thing the client asked for.

**Invariant 3's asymmetry (question hide cascades, answer hide doesn't) is
deliberate**, not an oversight: a hidden question with its answers still
visible reads as a broken orphaned thread; a hidden answer under an otherwise
fine question does not need to take the question down with it.

## 4. API Surface

**Customer** (public read, authenticated write):
- `GET /products/:productId/questions` — public; visible questions with their
  visible answers, upvote counts, and (if authenticated) whether the caller
  has upvoted each.
- `POST /products/:productId/questions` — authenticated.
- `POST /questions/:questionId/answers` — authenticated; the same endpoint an
  admin uses to answer (Invariant 6 derives the badge from the caller's role,
  so no separate admin-answer route exists).
- `POST` / `DELETE /questions/:questionId/upvote` — authenticated, toggle.
- `POST` / `DELETE /answers/:answerId/upvote` — authenticated, toggle.

**Admin**:
- `GET /admin/qa/questions` — every question (default: newest first),
  `include`-ing `product: { id, name, slug, image }` and `user: { id, name,
  email }` on the question and on each answer, plus each answer's own
  `isHidden` and upvote count — the product image/link is what lets an admin
  build context before answering, per the client's explicit ask. Supports
  `?unanswered=true` to surface questions with zero answers, since with no
  pre-approval queue, "needs an answer" is the actionable admin worklist,
  not "needs approval."
- `PATCH /admin/qa/questions/:id/moderate` — `{ hidden: boolean }`.
- `PATCH /admin/qa/answers/:id/moderate` — `{ hidden: boolean }`.

## 5. Events

**Publishes** — none. **Consumes** — none. Unlike Reviews, nothing here feeds
a rating aggregate or any other domain's derived state — a question being
asked or answered has no effect outside this domain.

## 6. Data Ownership

`questions` — `product_id` (reads Catalog), `user_id` (reads Identity),
`body`, `is_hidden` (default `false`), `created_at`, `updated_at`. Indexed
`(product_id, created_at DESC)` for the public per-product read path.

`answers` — `question_id`, `user_id`, `body`, `is_hidden` (default `false`),
`created_at`, `updated_at`. Indexed `(question_id, created_at ASC)` for
chronological thread order.

`question_upvotes` — unique `(question_id, user_id)`.
`answer_upvotes` — unique `(answer_id, user_id)`.

**Reads, does not own:** `products` (display context); `users` (display
context, role for the "by the store" badge).

## 7. Dependencies

**Allowed** — Catalog (read, product display); Identity (read, user display
and role).

**Forbidden** — writing `products` or `users`; any interaction with Reviews
(the two domains do not touch); reading Payments, Shopping, Ordering,
Inventory, Pricing, Returns — no business reason connects Q&A to any of them.

## 8. Edge Cases & Validations

1. **Question or answer on a product later unpublished or soft-deleted.**
   Remains in the database; the product page being unreachable makes it moot
   for customers, same as `DOM-REVIEWS` edge case 6. Still visible to admin
   for moderation.
2. **A user asks or answers, then their account is soft-deleted.** Displayed
   anonymously going forward (Invariant 7), evaluated on read — no backfill.
3. **Two upvotes on the same question from the same user, without an
   intervening un-upvote.** Rejected by the unique constraint with a clean
   409 — a double-click race, not a valid state.
4. **An empty or whitespace-only question/answer body.** Rejected by DTO
   validation before it reaches the database.
5. **Hiding a question that already has hidden answers.** The already-hidden
   answers stay hidden; the whole thread is now hidden regardless (Invariant
   3) — no state conflict, the cascade only ever adds visibility restriction,
   never removes it.
6. **Un-hiding a question whose answers include some individually hidden
   ones.** Those specific answers stay hidden (Invariant 4); only the
   question and its non-hidden answers become visible again.
7. **An anonymous (logged-out) visitor on a product page.** Sees the full Q&A
   thread (Invariant 8); Ask/Answer/Upvote controls prompt login, the same
   treatment the storefront already gives review submission.
8. **An admin answers their own product's question.** No special-cased path
   — it is the same `POST /questions/:questionId/answers` any customer uses;
   Invariant 6 badges it from the caller's role alone.

## Constitution compliance

Law 1 — no capability is claimed ahead of being built; this spec is Frozen
before implementation, not describing something already shipped. Law 2 —
every invariant sourced. Law 4 — Invariant 5 (one upvote per user) is
database-enforced via a unique constraint, the lowest layer that can enforce
it. Law 5 — this domain issues no commands and emits no events; it only
reads Catalog and Identity, which stays within command-in/event-out because a
read is not a write.

## Open items

- **No notification on answer.** A customer who asked a question is not
  notified when it's answered — `DOM-NOTIFICATION` integration is a plausible
  future enhancement, explicitly out of scope for `FEAT-PRODUCT-QA`'s first
  cut.
- **No rate limiting specified** beyond whatever global request-rate
  protection already exists at the API layer — a Q&A-specific abuse limit
  (e.g. N questions per user per hour) is not designed here.
