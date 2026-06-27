# Milestone 7 — Run/Validate the Stack + Complete Missing Backend Services

## Architecture Document
No changes to ARCHITECTURE.md's bounded-context map. One addition: a domain
event bus (`common/event-bus`) now exists as a concrete `@Global()` module,
closing the gap between ARCHITECTURE.md §5 (which always specified domain
events) and the Milestone 5 implementation (which didn't have a bus and
called services directly). See [`BACKEND.md`](../../BACKEND.md) §3.8.

## Tasks Completed

**Validation (run the actual stack for the first time):**
- [x] Installed PostgreSQL 16 (none was present), installed `apps/api` deps,
      ran `prisma generate` + `prisma migrate dev` against a real local DB
- [x] Found and fixed 3 bugs that blocked the app from even compiling/booting:
      a Prisma preview-feature typo, a missing `strictPropertyInitialization:
      false` in `tsconfig.json`, and a `Role` enum nominal-type mismatch
      between a hand-rolled enum and Prisma's generated one
- [x] Booted the NestJS server successfully; all 8 original modules' routes
      registered correctly
- [x] Smoke-tested via `curl`: register/login/profile (no passwordHash leak),
      public catalog browse, RBAC rejection, admin product+variant creation,
      checkout rejected for insufficient stock (409), checkout succeeding up
      to payment-intent creation then **correctly compensating** (stock
      released, order cancelled) when the placeholder Stripe key failed,
      coupon math verified to the paisa, review verified-purchase/moderation
      defaults confirmed correct
- [x] Applied the DATABASE.md §8.3 hand-authored follow-up migration (CHECK
      constraints + generated `search_vector` column) as an actual `.sql` file
      for the first time — previously only specified, never executed

**Backend completion (close gaps Milestone 5 named as deferred):**
- [x] Built a minimal in-process domain event bus (`EventBusService` on
      Node's `EventEmitter`), registered globally
- [x] Built `modules/notifications` — subscribes to `order.confirmed`,
      `return.requested`, `return.refunded`; sends via Resend if
      `RESEND_API_KEY` is set, otherwise logs and skips (never throws)
- [x] Built `modules/cart` — persisted server-side cart, additive (doesn't
      change `OrdersService.create`'s existing `items[]` contract)
- [x] Built `modules/wishlist` — CRUD + one public `GET /wishlist/shared/:token`
      read for the wishlist-sharing acquisition loop
- [x] Built `modules/returns` (FR-11) — full eligibility check, status
      machine, inventory restock + payment bookkeeping on refund, event
      emission
- [x] Wired `PaymentsService.markSucceeded` to emit `order.confirmed` instead
      of silently doing nothing after confirming payment
- [x] Re-validated all 4 new modules against the live server: Cart add/get,
      Wishlist add, full Returns lifecycle (REQUESTED → APPROVED →
      REFUND_PROCESSING → REFUNDED) with confirmed inventory restock and
      event-bus → notification-log firing
- [x] **Found and fixed a second `passwordHash` leak** — this time in the
      brand-new `ReturnsService`'s nested `include`, the same bug class
      already fixed once in Milestone 5's `UsersService`. Documented as a
      repeated mistake (BACKEND.md §3.7), not a one-off, with a standing rule
      recorded for future Prisma `include`s that touch `User`

## Tasks Remaining
- [ ] Automated test suite (Jest/Playwright) — still the single biggest gap;
      this session's manual `curl`/`psql` validation found 4 real bugs that a
      test suite should have caught before any human had to go looking
- [ ] Extend `PaymentProviderPort` with a `refund` method — Returns currently
      only does refund bookkeeping, doesn't call Stripe's refund API (named
      explicitly in BACKEND.md §3.11, not silently skipped)
- [ ] Test the live Stripe success path with a real test-mode secret key —
      this session only validated the failure/compensation path, since the
      placeholder key in `.env.example` can't authenticate with Stripe
- [ ] Frontend (`apps/web`) has still never been run — Milestone 6 built it,
      Milestone 7 validated only the backend; running both together is the
      next logical step
- [ ] Redis caching, Elasticsearch, gold-rate pricing, Auth.js bridging — all
      still open, unchanged from Milestone 5/6's lists
- [ ] Wire the frontend's local cart / Profile pages to the new Cart/Wishlist/
      Returns endpoints (frontend code currently doesn't know these exist yet)

## Updated Roadmap
1. Milestone 0 — Scaffold ✅
2. Milestone 1 — Product Discovery ✅
3. Milestone 2 — System Architecture ✅
4. Milestone 3 — UX/UI Design ✅
5. Milestone 4 — Database Engineering ✅
6. Milestone 5 — Backend Development ✅
7. Milestone 6 — Frontend Development ✅
8. **Milestone 7 — Validation + Backend Completion ✅ (this milestone)**
9. Milestone 8 — Frontend Validation (run `apps/web` for the first time,
   against this now-validated backend; wire Cart/Wishlist/Returns into the UI)
10. Milestone 9 — Admin Panel + Admin Dashboard frontend
11. Milestone 10 — Test suite (Jest unit tests for the 4 bug-prone areas
    found this milestone: checkout orchestration, inventory reservation,
    payment webhook handling, any Prisma `include` touching `User`)
12. Milestone 11 — Advanced/AI, real Collections API, Elasticsearch
13. Milestone 12 — Payments hardening (Stripe Elements, refund API, Razorpay
    activation decision)
14. Milestone 13 — Observability & Hardening (Redis, Auth.js bridge, real
    OWASP/WCAG/perf audits)
15. Milestone 14 — Deployment

## Risks and Mitigations
| Risk | Mitigation |
|---|---|
| Manual validation found 4 real bugs on the first run — more likely exist in untested paths (Stripe success path, frontend integration) | Explicitly flagged; Milestone 10 (test suite) is now justified by direct evidence rather than principle, and is prioritized higher in the roadmap than it was before this milestone |
| The same bug class (`passwordHash` leak via Prisma `include`) was written twice across two milestones by the same process | Named as a *repeated* mistake in BACKEND.md §3.7 rather than treated as a fixed one-off — recorded as a standing rule (`include` touching `User` always needs `select`) so it's checked for explicitly in future module reviews, not just relied on being remembered |
| Returns' refund flow updates bookkeeping but doesn't call Stripe — could look "done" if read superficially | Named explicitly in BACKEND.md §3.11 and §6.4, not glossed over |
| Local Postgres install (Homebrew) is dev-machine-specific, not yet codified as Docker Compose for reproducibility | `infra/docker` scaffold exists from Milestone 0 but docker-compose.yml was never written — flagged as a gap, not assumed solved by this session's manual install |
| Frontend still untested against this now-more-complete backend | Explicitly the next milestone (Milestone 8), not assumed to "just work" because the backend now passes its own smoke tests |
